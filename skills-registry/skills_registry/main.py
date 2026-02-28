"""SKSkills Registry API — FastAPI application.

Endpoints:
  GET  /api/skills                    — list / search all skills
  GET  /api/skills/{name}             — latest version of a skill
  GET  /api/skills/{name}/{version}   — specific version
  GET  /api/skills/{name}/{version}/download — tarball download
  POST /api/skills                    — publish a skill (requires CapAuth)
  POST /api/admin/publishers          — add trusted publisher (admin only)
  DELETE /api/skills/{name}/{version} — delete a skill (admin only)

Runs at: https://skills.smilintux.org/api
"""

from __future__ import annotations

import io
import json
import logging
import os
import tarfile
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .auth import PublisherClaims, _bearer, require_publisher
from .storage import SkillStorage

logger = logging.getLogger("skills_registry")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SkillEntry(BaseModel):
    name: str
    version: str
    description: str = ""
    author: str = ""
    author_fingerprint: str = ""
    tags: list[str] = Field(default_factory=list)
    signed: bool = False
    signed_by: str = ""
    sha256: str = ""
    download_url: str = ""
    published_at: str = ""


class SkillIndex(BaseModel):
    url: str
    total: int
    skills: list[SkillEntry]


class PublishResponse(BaseModel):
    ok: bool
    name: str
    version: str
    sha256: str
    download_url: str


class AddPublisherRequest(BaseModel):
    fingerprint: str
    name: str = ""
    email: str = ""


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

_storage: Optional[SkillStorage] = None


def get_storage() -> SkillStorage:
    if _storage is None:
        raise RuntimeError("Storage not initialised")
    return _storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _storage
    _storage = SkillStorage()
    logger.info("Skills registry storage ready at %s", _storage.db_path)
    yield
    _storage = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="SKSkills Registry",
        description="Sovereign Agent Skills — remote registry for skills.smilintux.org",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # -----------------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------------

    @app.get("/api/health", tags=["meta"])
    async def health():
        return {"status": "ok", "service": "skills-registry", "version": "0.1.0"}

    # -----------------------------------------------------------------------
    # Skill listing and search
    # -----------------------------------------------------------------------

    @app.get("/api/skills", response_model=SkillIndex, tags=["skills"])
    async def list_skills(
        q: Optional[str] = Query(default=None, description="Search query"),
        limit: int = Query(default=100, ge=1, le=500),
        storage: SkillStorage = Depends(get_storage),
        request: Request = None,
    ):
        """List all published skills. Supports keyword search via ?q=..."""
        rows = storage.list_skills(query=q, limit=limit)
        base = str(request.base_url).rstrip("/") if request else ""
        skills = [_row_to_entry(r, base) for r in rows]
        return SkillIndex(url=f"{base}/api", total=len(skills), skills=skills)

    # -----------------------------------------------------------------------
    # Skill detail
    # -----------------------------------------------------------------------

    @app.get("/api/skills/{name}", response_model=SkillEntry, tags=["skills"])
    async def get_skill(
        name: str,
        storage: SkillStorage = Depends(get_storage),
        request: Request = None,
    ):
        """Get the latest version of a skill."""
        row = storage.get_skill(name)
        if not row:
            raise HTTPException(status_code=404, detail=f"Skill not found: {name}")
        base = str(request.base_url).rstrip("/") if request else ""
        return _row_to_entry(row, base)

    @app.get("/api/skills/{name}/{version}", response_model=SkillEntry, tags=["skills"])
    async def get_skill_version(
        name: str,
        version: str,
        storage: SkillStorage = Depends(get_storage),
        request: Request = None,
    ):
        """Get a specific version of a skill."""
        row = storage.get_skill(name, version)
        if not row:
            raise HTTPException(
                status_code=404, detail=f"Skill not found: {name} v{version}"
            )
        base = str(request.base_url).rstrip("/") if request else ""
        return _row_to_entry(row, base)

    # -----------------------------------------------------------------------
    # Tarball download
    # -----------------------------------------------------------------------

    @app.get("/api/skills/{name}/{version}/download", tags=["skills"])
    async def download_skill(
        name: str,
        version: str,
        storage: SkillStorage = Depends(get_storage),
    ):
        """Download the skill tarball."""
        data = storage.get_tarball(name, version)
        if data is None:
            raise HTTPException(
                status_code=404, detail=f"Package not found: {name} v{version}"
            )
        filename = f"{name}-{version}.tar.gz"
        return Response(
            content=data,
            media_type="application/gzip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # -----------------------------------------------------------------------
    # Publish
    # -----------------------------------------------------------------------

    @app.post("/api/skills", response_model=PublishResponse, status_code=201, tags=["publish"])
    async def publish_skill(
        tarball: UploadFile = File(..., description="Skill tarball (.tar.gz)"),
        storage: SkillStorage = Depends(get_storage),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
        request: Request = None,
    ):
        """Publish a skill to the registry.

        Upload a `.tar.gz` containing a `skill.yaml` at its root.
        Requires CapAuth Bearer token (or admin token).

        The tarball must contain a valid `skill.yaml` — name and version
        are extracted from it automatically.
        """
        # Authenticate
        claims = require_publisher(credentials, storage)

        if not tarball.filename or not tarball.filename.endswith(".tar.gz"):
            raise HTTPException(
                status_code=400,
                detail="File must be a .tar.gz tarball",
            )

        tarball_bytes = await tarball.read()

        # Extract and validate skill.yaml from tarball
        try:
            manifest = _extract_manifest(tarball_bytes)
        except (ValueError, KeyError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        base = str(request.base_url).rstrip("/") if request else ""

        try:
            result = storage.publish_skill(
                name=manifest["name"],
                version=manifest["version"],
                description=manifest.get("description", ""),
                author=manifest.get("author", {}).get("name", "") if isinstance(manifest.get("author"), dict) else str(manifest.get("author", "")),
                author_fingerprint=manifest.get("author", {}).get("fingerprint", "") if isinstance(manifest.get("author"), dict) else "",
                tags=manifest.get("tags", []),
                signed=bool(manifest.get("signature")),
                signed_by=manifest.get("signed_by", ""),
                tarball_bytes=tarball_bytes,
                publisher_fingerprint=claims.fingerprint,
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc))

        return PublishResponse(
            ok=True,
            name=result["name"],
            version=result["version"],
            sha256=result["sha256"],
            download_url=f"{base}{result['download_path']}",
        )

    # -----------------------------------------------------------------------
    # Admin endpoints
    # -----------------------------------------------------------------------

    @app.post("/api/admin/publishers", status_code=201, tags=["admin"])
    async def add_publisher(
        body: AddPublisherRequest,
        storage: SkillStorage = Depends(get_storage),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    ):
        """Add a trusted CapAuth publisher fingerprint (admin token required)."""
        claims = require_publisher(credentials, storage)
        if not claims.is_admin:
            raise HTTPException(status_code=403, detail="Admin token required")
        storage.add_trusted_publisher(
            fingerprint=body.fingerprint,
            name=body.name,
            email=body.email,
            trusted_by=claims.fingerprint,
        )
        return {"ok": True, "fingerprint": body.fingerprint}

    @app.delete("/api/skills/{name}/{version}", status_code=200, tags=["admin"])
    async def delete_skill(
        name: str,
        version: str,
        storage: SkillStorage = Depends(get_storage),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    ):
        """Delete a skill version (admin only)."""
        claims = require_publisher(credentials, storage)
        if not claims.is_admin:
            raise HTTPException(status_code=403, detail="Admin token required")
        deleted = storage.delete_skill(name, version)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Not found: {name} v{version}")
        return {"ok": True, "deleted": f"{name}@{version}"}

    return app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _row_to_entry(row: dict, base_url: str = "") -> SkillEntry:
    """Convert a DB row dict to a SkillEntry."""
    tags = row.get("tags", "[]")
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except json.JSONDecodeError:
            tags = []

    name = row["name"]
    version = row["version"]
    download_url = f"{base_url}/api/skills/{name}/{version}/download"

    return SkillEntry(
        name=name,
        version=version,
        description=row.get("description", ""),
        author=row.get("author", ""),
        author_fingerprint=row.get("author_fingerprint", ""),
        tags=tags,
        signed=bool(row.get("signed", 0)),
        signed_by=row.get("signed_by", ""),
        sha256=row.get("sha256", ""),
        download_url=download_url,
        published_at=row.get("published_at", ""),
    )


def _extract_manifest(tarball_bytes: bytes) -> dict:
    """Extract and parse skill.yaml from a tarball.

    Returns:
        Parsed YAML dict.

    Raises:
        ValueError: If skill.yaml is missing or invalid.
    """
    import yaml

    buf = io.BytesIO(tarball_bytes)
    try:
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            # Find skill.yaml — might be at root or inside a subdirectory
            skill_yaml_member = None
            for member in tar.getmembers():
                parts = Path(member.name).parts
                # Reject path traversal
                if ".." in parts or member.name.startswith("/"):
                    raise ValueError(f"Unsafe path in tarball: {member.name}")
                # Accept skill.yaml at root or one level deep
                if Path(member.name).name == "skill.yaml" and len(parts) <= 2:
                    if skill_yaml_member is None or len(parts) < len(Path(skill_yaml_member.name).parts):
                        skill_yaml_member = member

            if skill_yaml_member is None:
                raise ValueError("No skill.yaml found in tarball root (must be at depth 0 or 1)")

            f = tar.extractfile(skill_yaml_member)
            if f is None:
                raise ValueError("Could not read skill.yaml from tarball")

            raw = yaml.safe_load(f.read())
    except tarfile.TarError as exc:
        raise ValueError(f"Invalid tarball: {exc}")

    if not isinstance(raw, dict):
        raise ValueError("skill.yaml must be a YAML mapping")
    if not raw.get("name"):
        raise ValueError("skill.yaml missing required field: name")
    if not raw.get("version"):
        raw["version"] = "0.1.0"

    return raw


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "skills_registry.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080")),
        reload=os.environ.get("DEV", "").lower() in ("1", "true"),
        log_level="info",
    )

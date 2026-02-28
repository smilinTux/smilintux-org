"""Integration tests for the skills registry API."""

from __future__ import annotations

import hashlib
import io
import os
import tarfile
import tempfile
from pathlib import Path

import pytest
import yaml
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def tmp_storage(tmp_path_factory):
    """Isolated SkillStorage for testing."""
    from skills_registry.storage import SkillStorage

    base = tmp_path_factory.mktemp("registry")
    return SkillStorage(db_path=base / "registry.db", packages_dir=base / "packages")


@pytest.fixture(scope="module")
async def client(tmp_storage):
    """Async HTTP test client with dependency-overridden storage."""
    os.environ["REGISTRY_OPEN_PUBLISH"] = "true"

    from skills_registry.main import create_app, get_storage

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: tmp_storage

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


def make_tarball(name: str, version: str, description: str = "", tags: list[str] | None = None) -> bytes:
    """Build a minimal skill tarball in memory."""
    manifest = {
        "name": name,
        "version": version,
        "description": description,
        "author": {"name": "test-author"},
        "tags": tags or [],
    }
    yaml_bytes = yaml.dump(manifest).encode()

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        info = tarfile.TarInfo(name="skill.yaml")
        info.size = len(yaml_bytes)
        tar.addfile(info, io.BytesIO(yaml_bytes))

    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Empty registry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_empty(client):
    resp = await client.get("/api/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert "skills" in data
    assert isinstance(data["skills"], list)


# ---------------------------------------------------------------------------
# Publish flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_skill(client):
    tb = make_tarball("test-skill", "0.1.0", "A test skill", ["testing", "ci"])
    resp = await client.post(
        "/api/skills",
        files={"tarball": ("test-skill-0.1.0.tar.gz", tb, "application/gzip")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data["name"] == "test-skill"
    assert data["version"] == "0.1.0"
    assert len(data["sha256"]) == 64


@pytest.mark.asyncio
async def test_list_after_publish(client):
    resp = await client.get("/api/skills")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["skills"]]
    assert "test-skill" in names


@pytest.mark.asyncio
async def test_get_skill(client):
    resp = await client.get("/api/skills/test-skill")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test-skill"
    assert data["version"] == "0.1.0"
    assert "testing" in data["tags"]


@pytest.mark.asyncio
async def test_get_skill_version(client):
    resp = await client.get("/api/skills/test-skill/0.1.0")
    assert resp.status_code == 200
    assert resp.json()["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_get_skill_not_found(client):
    resp = await client.get("/api/skills/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_download_skill(client):
    resp = await client.get("/api/skills/test-skill/0.1.0/download")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/gzip"
    assert len(resp.content) > 0


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_by_name(client):
    # Publish a second skill for searching
    tb = make_tarball("syncthing-setup", "0.2.0", "Syncthing sovereign sync", ["sync", "storage"])
    await client.post(
        "/api/skills",
        files={"tarball": ("syncthing-setup-0.2.0.tar.gz", tb, "application/gzip")},
    )

    resp = await client.get("/api/skills?q=syncthing")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["skills"]]
    assert "syncthing-setup" in names
    assert "test-skill" not in names


@pytest.mark.asyncio
async def test_search_by_tag(client):
    resp = await client.get("/api/skills?q=testing")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["skills"]]
    assert "test-skill" in names


# ---------------------------------------------------------------------------
# Duplicate publish
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_duplicate_publish_rejected(client):
    tb = make_tarball("test-skill", "0.1.0")
    resp = await client.post(
        "/api/skills",
        files={"tarball": ("test-skill-0.1.0.tar.gz", tb, "application/gzip")},
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Bad tarball
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_bad_tarball(client):
    resp = await client.post(
        "/api/skills",
        files={"tarball": ("bad.tar.gz", b"not a tarball", "application/gzip")},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_publish_wrong_extension(client):
    resp = await client.post(
        "/api/skills",
        files={"tarball": ("skill.zip", b"data", "application/zip")},
    )
    assert resp.status_code == 400

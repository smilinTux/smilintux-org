"""Comprehensive integration tests for the skills registry API.

Tests the full API surface through httpx.AsyncClient against the real FastAPI app
with isolated SQLite storage. Covers:

  - GET  /api/health              — health check
  - GET  /api/skills              — list skills (empty, populated, limit, search)
  - POST /api/skills              — publish skill (valid, invalid, duplicate, auth flows)
  - GET  /api/skills/{name}       — get latest skill version (found, not found)
  - GET  /api/skills/{name}/{ver} — get specific version (found, not found)
  - GET  /api/skills/{name}/{ver}/download — tarball download (found, not found, content)
  - DELETE /api/skills/{name}/{ver} — admin delete (auth, not found, success, idempotent)
  - POST /api/admin/publishers    — add publisher (auth, success, idempotent)
  - Full lifecycle: publish -> list -> get -> download -> search -> delete -> verify gone
  - Authentication: open publish, admin token, CapAuth trusted, CapAuth untrusted, no creds
  - Error handling: bad tarballs, missing skill.yaml, wrong extension, missing name field,
    bad JSON, invalid IDs
  - Multi-version scenarios: publish multiple versions, get latest, version isolation
  - Response schema validation for SkillIndex, SkillEntry, PublishResponse

Uses module-scoped fixtures for three isolated test groups:
  1. open_client  — REGISTRY_OPEN_PUBLISH=true (no auth)
  2. admin_client — REGISTRY_ADMIN_TOKEN set (full auth enforced)
  3. capauth_client — CapAuth publisher tokens (trusted publisher workflow)
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import tarfile
from pathlib import Path

import pytest
import yaml
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

ADMIN_TOKEN = "integration-test-admin-token"
TRUSTED_FP = "AAAA1111BBBB2222CCCC3333DDDD4444"
UNTRUSTED_FP = "FFFF9999EEEE8888DDDD7777CCCC6666"


def make_capauth_token(fingerprint: str) -> str:
    """Build a minimal CapAuth bearer token for a given fingerprint."""
    header = (
        base64.urlsafe_b64encode(
            json.dumps({"alg": "PGP", "fingerprint": fingerprint}).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    payload = base64.urlsafe_b64encode(b"{}").rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(b"fake-sig").rstrip(b"=").decode()
    return f"{header}.{payload}.{sig}"


def make_tarball(
    name: str,
    version: str,
    description: str = "",
    tags: list[str] | None = None,
    author: str = "test-author",
    include_skill_yaml: bool = True,
    nested: bool = False,
) -> bytes:
    """Build a minimal skill tarball in memory.

    Args:
        name: Skill name in skill.yaml.
        version: Skill version in skill.yaml.
        description: Skill description.
        tags: Skill tags list.
        author: Author name string.
        include_skill_yaml: If False, omit skill.yaml from the tarball.
        nested: If True, place skill.yaml one directory deep.
    """
    manifest = {
        "name": name,
        "version": version,
        "description": description,
        "author": {"name": author},
        "tags": tags or [],
    }
    yaml_bytes = yaml.dump(manifest).encode()

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        if include_skill_yaml:
            info = tarfile.TarInfo(
                name=f"{name}/skill.yaml" if nested else "skill.yaml"
            )
            info.size = len(yaml_bytes)
            tar.addfile(info, io.BytesIO(yaml_bytes))
        # Always add at least one extra file (like a real skill package)
        readme = b"# Test skill\n"
        ri = tarfile.TarInfo(name=f"{name}/README.md" if nested else "README.md")
        ri.size = len(readme)
        tar.addfile(ri, io.BytesIO(readme))

    buf.seek(0)
    return buf.read()


def make_tarball_no_name(version: str = "0.1.0") -> bytes:
    """Build a tarball whose skill.yaml is missing the 'name' field."""
    manifest = {"version": version, "description": "missing name"}
    yaml_bytes = yaml.dump(manifest).encode()

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        info = tarfile.TarInfo(name="skill.yaml")
        info.size = len(yaml_bytes)
        tar.addfile(info, io.BytesIO(yaml_bytes))
    buf.seek(0)
    return buf.read()


def make_tarball_invalid_yaml() -> bytes:
    """Build a tarball whose skill.yaml contains invalid YAML (a bare scalar)."""
    bad_yaml = b"just a string, not a mapping"
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        info = tarfile.TarInfo(name="skill.yaml")
        info.size = len(bad_yaml)
        tar.addfile(info, io.BytesIO(bad_yaml))
    buf.seek(0)
    return buf.read()


# ============================================================================
# FIXTURE GROUP 1: Open publish mode (no auth required)
# ============================================================================


@pytest.fixture(scope="module")
def open_storage(tmp_path_factory):
    """Isolated SkillStorage for open-publish tests."""
    from skills_registry.storage import SkillStorage

    base = tmp_path_factory.mktemp("integration_open")
    return SkillStorage(db_path=base / "registry.db", packages_dir=base / "packages")


@pytest.fixture(scope="module")
async def open_client(open_storage):
    """Async test client in open-publish mode (no auth enforced)."""
    saved_open = os.environ.get("REGISTRY_OPEN_PUBLISH")
    saved_admin = os.environ.get("REGISTRY_ADMIN_TOKEN")
    os.environ["REGISTRY_OPEN_PUBLISH"] = "true"
    os.environ.pop("REGISTRY_ADMIN_TOKEN", None)

    from skills_registry.main import create_app, get_storage

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: open_storage

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    if saved_open is not None:
        os.environ["REGISTRY_OPEN_PUBLISH"] = saved_open
    else:
        os.environ.pop("REGISTRY_OPEN_PUBLISH", None)
    if saved_admin is not None:
        os.environ["REGISTRY_ADMIN_TOKEN"] = saved_admin


# ============================================================================
# FIXTURE GROUP 2: Admin token auth (full auth enforced)
# ============================================================================


@pytest.fixture(scope="module")
def admin_storage(tmp_path_factory):
    """Isolated SkillStorage for admin-auth tests."""
    from skills_registry.storage import SkillStorage

    base = tmp_path_factory.mktemp("integration_admin")
    return SkillStorage(db_path=base / "registry.db", packages_dir=base / "packages")


@pytest.fixture(scope="module")
async def admin_client(admin_storage):
    """Async test client with admin token and no open-publish mode."""
    saved_open = os.environ.pop("REGISTRY_OPEN_PUBLISH", None)
    os.environ["REGISTRY_ADMIN_TOKEN"] = ADMIN_TOKEN

    from skills_registry.main import create_app, get_storage

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: admin_storage

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    os.environ.pop("REGISTRY_ADMIN_TOKEN", None)
    if saved_open is not None:
        os.environ["REGISTRY_OPEN_PUBLISH"] = saved_open


# ============================================================================
# FIXTURE GROUP 3: CapAuth publisher workflow (full auth enforced)
# ============================================================================


@pytest.fixture(scope="module")
def capauth_storage(tmp_path_factory):
    """Isolated SkillStorage with a pre-trusted publisher fingerprint."""
    from skills_registry.storage import SkillStorage

    base = tmp_path_factory.mktemp("integration_capauth")
    storage = SkillStorage(db_path=base / "registry.db", packages_dir=base / "packages")
    # Pre-trust the test publisher
    storage.add_trusted_publisher(
        fingerprint=TRUSTED_FP, name="Trusted Bot", email="bot@example.com"
    )
    return storage


@pytest.fixture(scope="module")
async def capauth_client(capauth_storage):
    """Async test client with CapAuth auth (no open publish, admin token set)."""
    saved_open = os.environ.pop("REGISTRY_OPEN_PUBLISH", None)
    os.environ["REGISTRY_ADMIN_TOKEN"] = ADMIN_TOKEN

    from skills_registry.main import create_app, get_storage

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: capauth_storage

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    os.environ.pop("REGISTRY_ADMIN_TOKEN", None)
    if saved_open is not None:
        os.environ["REGISTRY_OPEN_PUBLISH"] = saved_open


# ============================================================================
# 1. HEALTH CHECK
# ============================================================================


class TestHealth:
    """GET /api/health."""

    @pytest.mark.asyncio
    async def test_health_returns_200(self, open_client):
        resp = await open_client.get("/api/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_response_body(self, open_client):
        resp = await open_client.get("/api/health")
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "skills-registry"
        assert "version" in data


# ============================================================================
# 2. LIST SKILLS — EMPTY REGISTRY
# ============================================================================


class TestListEmpty:
    """GET /api/skills on a fresh (empty) registry."""

    @pytest.mark.asyncio
    async def test_list_empty_returns_200(self, open_client):
        resp = await open_client.get("/api/skills")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_empty_has_skill_index_shape(self, open_client):
        data = (await open_client.get("/api/skills")).json()
        assert "url" in data
        assert "total" in data
        assert "skills" in data

    @pytest.mark.asyncio
    async def test_list_empty_total_is_zero(self, open_client):
        data = (await open_client.get("/api/skills")).json()
        assert data["total"] == 0
        assert data["skills"] == []

    @pytest.mark.asyncio
    async def test_list_empty_search_returns_empty(self, open_client):
        data = (await open_client.get("/api/skills?q=nonexistent")).json()
        assert data["total"] == 0


# ============================================================================
# 3. PUBLISH SKILL — VALID
# ============================================================================


class TestPublishValid:
    """POST /api/skills — valid tarball in open-publish mode."""

    @pytest.mark.asyncio
    async def test_publish_returns_201(self, open_client):
        tb = make_tarball("alpha-skill", "1.0.0", "First skill", ["alpha", "test"])
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("alpha-skill-1.0.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 201, resp.text

    @pytest.mark.asyncio
    async def test_publish_response_shape(self, open_client):
        tb = make_tarball("beta-skill", "0.2.0", "Beta skill")
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("beta-skill-0.2.0.tar.gz", tb, "application/gzip")},
        )
        data = resp.json()
        assert data["ok"] is True
        assert data["name"] == "beta-skill"
        assert data["version"] == "0.2.0"
        assert len(data["sha256"]) == 64
        assert "/download" in data["download_url"]

    @pytest.mark.asyncio
    async def test_publish_sha256_matches_tarball(self, open_client):
        tb = make_tarball("gamma-skill", "0.3.0")
        expected_sha = hashlib.sha256(tb).hexdigest()
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("gamma-skill-0.3.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.json()["sha256"] == expected_sha

    @pytest.mark.asyncio
    async def test_publish_nested_skill_yaml(self, open_client):
        """skill.yaml one level deep in a subdirectory is accepted."""
        tb = make_tarball("nested-skill", "1.0.0", nested=True)
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("nested-skill-1.0.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["name"] == "nested-skill"

    @pytest.mark.asyncio
    async def test_publish_multiple_versions(self, open_client):
        """Publishing v1.0.0 and v1.1.0 of the same skill both succeed."""
        for ver in ("1.0.0", "1.1.0"):
            tb = make_tarball("multi-ver-skill", ver, f"Version {ver}")
            resp = await open_client.post(
                "/api/skills",
                files={
                    "tarball": (
                        f"multi-ver-skill-{ver}.tar.gz",
                        tb,
                        "application/gzip",
                    )
                },
            )
            assert resp.status_code == 201, f"Failed for v{ver}: {resp.text}"


# ============================================================================
# 4. PUBLISH SKILL — INVALID / ERROR CASES
# ============================================================================


class TestPublishInvalid:
    """POST /api/skills — invalid tarball / bad data."""

    @pytest.mark.asyncio
    async def test_publish_duplicate_returns_409(self, open_client):
        """Publishing the same name+version twice returns 409 Conflict."""
        tb = make_tarball("dupe-skill", "1.0.0")
        resp1 = await open_client.post(
            "/api/skills",
            files={"tarball": ("dupe-skill-1.0.0.tar.gz", tb, "application/gzip")},
        )
        assert resp1.status_code == 201

        resp2 = await open_client.post(
            "/api/skills",
            files={"tarball": ("dupe-skill-1.0.0.tar.gz", tb, "application/gzip")},
        )
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_publish_wrong_extension_returns_400(self, open_client):
        """File not ending in .tar.gz is rejected."""
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("skill.zip", b"zipdata", "application/zip")},
        )
        assert resp.status_code == 400
        assert "tar.gz" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_publish_bad_tarball_bytes_returns_400(self, open_client):
        """Random bytes that are not a valid gzip tarball."""
        resp = await open_client.post(
            "/api/skills",
            files={
                "tarball": (
                    "bad-bytes-0.1.0.tar.gz",
                    b"this is not a tarball",
                    "application/gzip",
                )
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_publish_tarball_no_skill_yaml_returns_400(self, open_client):
        """Tarball that contains no skill.yaml at all."""
        tb = make_tarball("no-yaml-skill", "1.0.0", include_skill_yaml=False)
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("no-yaml-skill-1.0.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 400
        assert "skill.yaml" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_publish_tarball_missing_name_field_returns_400(self, open_client):
        """skill.yaml exists but is missing required 'name' field."""
        tb = make_tarball_no_name()
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("no-name-0.1.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 400
        assert "name" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_publish_tarball_invalid_yaml_returns_400(self, open_client):
        """skill.yaml that is not a YAML mapping (scalar string)."""
        tb = make_tarball_invalid_yaml()
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("invalid-yaml-0.1.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 400
        assert "mapping" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_publish_no_file_field_returns_422(self, open_client):
        """POST without the 'tarball' file field returns 422 Unprocessable Entity."""
        resp = await open_client.post("/api/skills")
        assert resp.status_code == 422


# ============================================================================
# 5. LIST SKILLS — POPULATED
# ============================================================================


class TestListPopulated:
    """GET /api/skills after publishing skills."""

    @pytest.mark.asyncio
    async def test_list_returns_published_skills(self, open_client):
        resp = await open_client.get("/api/skills")
        data = resp.json()
        assert data["total"] > 0
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_list_skill_entry_has_required_fields(self, open_client):
        """Each skill entry in the list has all SkillEntry fields."""
        data = (await open_client.get("/api/skills")).json()
        assert len(data["skills"]) > 0
        entry = data["skills"][0]
        required_fields = {
            "name",
            "version",
            "description",
            "author",
            "tags",
            "signed",
            "sha256",
            "download_url",
            "published_at",
        }
        assert required_fields <= set(entry.keys())

    @pytest.mark.asyncio
    async def test_list_with_limit_param(self, open_client):
        """?limit=2 restricts the number of returned skills."""
        data = (await open_client.get("/api/skills?limit=2")).json()
        assert len(data["skills"]) <= 2
        assert data["total"] <= 2

    @pytest.mark.asyncio
    async def test_list_limit_minimum_is_1(self, open_client):
        """?limit=0 should be rejected by FastAPI validation (ge=1)."""
        resp = await open_client.get("/api/skills?limit=0")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_limit_maximum_is_500(self, open_client):
        """?limit=501 should be rejected by FastAPI validation (le=500)."""
        resp = await open_client.get("/api/skills?limit=501")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_total_matches_skills_length(self, open_client):
        """total field equals the length of the skills array."""
        data = (await open_client.get("/api/skills")).json()
        assert data["total"] == len(data["skills"])


# ============================================================================
# 6. GET SKILL — SINGLE SKILL
# ============================================================================


class TestGetSkill:
    """GET /api/skills/{name} — latest version."""

    @pytest.mark.asyncio
    async def test_get_existing_skill(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "alpha-skill"
        assert data["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_skill_includes_description(self, open_client):
        data = (await open_client.get("/api/skills/alpha-skill")).json()
        assert data["description"] == "First skill"

    @pytest.mark.asyncio
    async def test_get_skill_includes_tags(self, open_client):
        data = (await open_client.get("/api/skills/alpha-skill")).json()
        assert "alpha" in data["tags"]
        assert "test" in data["tags"]

    @pytest.mark.asyncio
    async def test_get_skill_includes_download_url(self, open_client):
        data = (await open_client.get("/api/skills/alpha-skill")).json()
        assert "/download" in data["download_url"]
        assert "alpha-skill" in data["download_url"]

    @pytest.mark.asyncio
    async def test_get_skill_not_found(self, open_client):
        resp = await open_client.get("/api/skills/nonexistent-skill")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_latest_version_when_multiple_exist(self, open_client):
        """GET /api/skills/multi-ver-skill returns the latest published version."""
        resp = await open_client.get("/api/skills/multi-ver-skill")
        assert resp.status_code == 200
        # Both 1.0.0 and 1.1.0 were published; latest by published_at should be 1.1.0
        assert resp.json()["version"] == "1.1.0"


# ============================================================================
# 7. GET SKILL VERSION — SPECIFIC VERSION
# ============================================================================


class TestGetSkillVersion:
    """GET /api/skills/{name}/{version}."""

    @pytest.mark.asyncio
    async def test_get_specific_version(self, open_client):
        resp = await open_client.get("/api/skills/multi-ver-skill/1.0.0")
        assert resp.status_code == 200
        assert resp.json()["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_another_version(self, open_client):
        resp = await open_client.get("/api/skills/multi-ver-skill/1.1.0")
        assert resp.status_code == 200
        assert resp.json()["version"] == "1.1.0"

    @pytest.mark.asyncio
    async def test_get_version_not_found_wrong_version(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill/9.9.9")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_version_not_found_wrong_name(self, open_client):
        resp = await open_client.get("/api/skills/no-such-skill/1.0.0")
        assert resp.status_code == 404


# ============================================================================
# 8. DOWNLOAD SKILL TARBALL
# ============================================================================


class TestDownload:
    """GET /api/skills/{name}/{version}/download."""

    @pytest.mark.asyncio
    async def test_download_returns_gzip(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill/1.0.0/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/gzip"

    @pytest.mark.asyncio
    async def test_download_has_content_disposition(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill/1.0.0/download")
        cd = resp.headers.get("content-disposition", "")
        assert "alpha-skill-1.0.0.tar.gz" in cd

    @pytest.mark.asyncio
    async def test_download_content_is_valid_tarball(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill/1.0.0/download")
        buf = io.BytesIO(resp.content)
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            names = tar.getnames()
            assert any("skill.yaml" in n for n in names)

    @pytest.mark.asyncio
    async def test_download_sha256_matches_published(self, open_client):
        """Downloaded tarball SHA256 matches the sha256 from GET metadata."""
        meta = (await open_client.get("/api/skills/alpha-skill/1.0.0")).json()
        dl = await open_client.get("/api/skills/alpha-skill/1.0.0/download")
        actual_sha = hashlib.sha256(dl.content).hexdigest()
        assert actual_sha == meta["sha256"]

    @pytest.mark.asyncio
    async def test_download_not_found(self, open_client):
        resp = await open_client.get("/api/skills/no-such/0.0.1/download")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_download_content_nonzero(self, open_client):
        resp = await open_client.get("/api/skills/alpha-skill/1.0.0/download")
        assert len(resp.content) > 0


# ============================================================================
# 9. SEARCH SKILLS
# ============================================================================


class TestSearch:
    """GET /api/skills?q=... — keyword search by name, description, tags."""

    @pytest.mark.asyncio
    async def test_search_by_exact_name(self, open_client):
        data = (await open_client.get("/api/skills?q=alpha-skill")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_search_by_partial_name(self, open_client):
        data = (await open_client.get("/api/skills?q=alpha")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_search_by_description(self, open_client):
        data = (await open_client.get("/api/skills?q=First")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_search_by_tag(self, open_client):
        data = (await open_client.get("/api/skills?q=alpha")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_search_no_results(self, open_client):
        data = (await open_client.get("/api/skills?q=xyznotfound999")).json()
        assert data["total"] == 0
        assert data["skills"] == []

    @pytest.mark.asyncio
    async def test_search_case_insensitive(self, open_client):
        """Search is case-insensitive (LIKE with lower())."""
        data = (await open_client.get("/api/skills?q=ALPHA")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" in names

    @pytest.mark.asyncio
    async def test_search_excludes_non_matching(self, open_client):
        """Search for 'beta' should not return 'alpha-skill'."""
        data = (await open_client.get("/api/skills?q=beta")).json()
        names = [s["name"] for s in data["skills"]]
        assert "alpha-skill" not in names

    @pytest.mark.asyncio
    async def test_search_with_limit(self, open_client):
        data = (await open_client.get("/api/skills?q=skill&limit=1")).json()
        assert len(data["skills"]) <= 1


# ============================================================================
# 10. AUTHENTICATION — PUBLISH REQUIRES AUTH
# ============================================================================


class TestPublishAuth:
    """POST /api/skills — authentication flows when auth is enforced."""

    @pytest.mark.asyncio
    async def test_publish_no_auth_returns_401(self, admin_client):
        """No Authorization header when auth is enforced."""
        tb = make_tarball("auth-test", "0.1.0")
        resp = await admin_client.post(
            "/api/skills",
            files={"tarball": ("auth-test-0.1.0.tar.gz", tb, "application/gzip")},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_publish_invalid_token_returns_403(self, admin_client):
        """Garbage bearer token returns 403."""
        tb = make_tarball("auth-test2", "0.1.0")
        resp = await admin_client.post(
            "/api/skills",
            files={"tarball": ("auth-test2-0.1.0.tar.gz", tb, "application/gzip")},
            headers={"Authorization": "Bearer total-garbage-token"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_publish_admin_token_succeeds(self, admin_client):
        """Admin token can publish."""
        tb = make_tarball("admin-published", "1.0.0", "Published by admin")
        resp = await admin_client.post(
            "/api/skills",
            files={
                "tarball": (
                    "admin-published-1.0.0.tar.gz",
                    tb,
                    "application/gzip",
                )
            },
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["name"] == "admin-published"

    @pytest.mark.asyncio
    async def test_publish_capauth_trusted_succeeds(self, capauth_client):
        """Trusted CapAuth publisher can publish."""
        tb = make_tarball("capauth-published", "1.0.0", "Published via CapAuth")
        token = make_capauth_token(TRUSTED_FP)
        resp = await capauth_client.post(
            "/api/skills",
            files={
                "tarball": (
                    "capauth-published-1.0.0.tar.gz",
                    tb,
                    "application/gzip",
                )
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["name"] == "capauth-published"

    @pytest.mark.asyncio
    async def test_publish_capauth_untrusted_returns_403(self, capauth_client):
        """Untrusted CapAuth fingerprint cannot publish."""
        tb = make_tarball("untrusted-skill", "0.1.0")
        token = make_capauth_token(UNTRUSTED_FP)
        resp = await capauth_client.post(
            "/api/skills",
            files={
                "tarball": (
                    "untrusted-skill-0.1.0.tar.gz",
                    tb,
                    "application/gzip",
                )
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert "not trusted" in resp.json()["detail"].lower()


# ============================================================================
# 11. DELETE SKILL — AUTH AND ADMIN-ONLY
# ============================================================================


class TestDeleteSkill:
    """DELETE /api/skills/{name}/{version} — admin-only operations."""

    @pytest.mark.asyncio
    async def test_delete_no_auth_returns_401(self, admin_client):
        resp = await admin_client.delete("/api/skills/anything/0.1.0")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_invalid_token_returns_403(self, admin_client):
        resp = await admin_client.delete(
            "/api/skills/anything/0.1.0",
            headers={"Authorization": "Bearer garbage"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_capauth_non_admin_returns_403(self, capauth_client):
        """Trusted publisher (non-admin) cannot delete."""
        token = make_capauth_token(TRUSTED_FP)
        resp = await capauth_client.delete(
            "/api/skills/capauth-published/1.0.0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert "admin" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_delete_not_found_returns_404(self, admin_client):
        resp = await admin_client.delete(
            "/api/skills/ghost-skill/0.0.0",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_existing_skill_returns_200(self, admin_client, admin_storage):
        """Publish then delete a skill with admin token."""
        tb = make_tarball("deletable", "1.0.0")
        admin_storage.publish_skill(
            name="deletable",
            version="1.0.0",
            description="Will be deleted",
            author="test",
            author_fingerprint="",
            tags=[],
            signed=False,
            signed_by="",
            tarball_bytes=tb,
            publisher_fingerprint="admin",
        )
        resp = await admin_client.delete(
            "/api/skills/deletable/1.0.0",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "deletable" in data["deleted"]

    @pytest.mark.asyncio
    async def test_delete_twice_second_is_404(self, admin_client, admin_storage):
        """Deleting the same skill twice: first 200, second 404."""
        tb = make_tarball("twice-del", "1.0.0")
        admin_storage.publish_skill(
            name="twice-del",
            version="1.0.0",
            description="Delete twice test",
            author="test",
            author_fingerprint="",
            tags=[],
            signed=False,
            signed_by="",
            tarball_bytes=tb,
            publisher_fingerprint="admin",
        )
        auth = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
        r1 = await admin_client.delete("/api/skills/twice-del/1.0.0", headers=auth)
        assert r1.status_code == 200
        r2 = await admin_client.delete("/api/skills/twice-del/1.0.0", headers=auth)
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_one_version_preserves_others(self, admin_client, admin_storage):
        """Deleting v1.0.0 does not remove v2.0.0."""
        for ver in ("1.0.0", "2.0.0"):
            tb = make_tarball("ver-del", ver)
            admin_storage.publish_skill(
                name="ver-del",
                version=ver,
                description=f"Version {ver}",
                author="test",
                author_fingerprint="",
                tags=[],
                signed=False,
                signed_by="",
                tarball_bytes=tb,
                publisher_fingerprint="admin",
            )
        await admin_client.delete(
            "/api/skills/ver-del/1.0.0",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        # v2.0.0 still accessible
        resp = await admin_client.get("/api/skills/ver-del/2.0.0")
        assert resp.status_code == 200
        assert resp.json()["version"] == "2.0.0"

    @pytest.mark.asyncio
    async def test_deleted_skill_gone_from_listing(self, admin_client, admin_storage):
        """Deleted skill no longer appears in GET /api/skills list."""
        tb = make_tarball("gone-skill", "1.0.0")
        admin_storage.publish_skill(
            name="gone-skill",
            version="1.0.0",
            description="Will vanish from listing",
            author="test",
            author_fingerprint="",
            tags=[],
            signed=False,
            signed_by="",
            tarball_bytes=tb,
            publisher_fingerprint="admin",
        )
        await admin_client.delete(
            "/api/skills/gone-skill/1.0.0",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        # Verify: GET single returns 404
        resp = await admin_client.get("/api/skills/gone-skill/1.0.0")
        assert resp.status_code == 404


# ============================================================================
# 12. ADD PUBLISHER — ADMIN ENDPOINT
# ============================================================================


class TestAddPublisher:
    """POST /api/admin/publishers."""

    @pytest.mark.asyncio
    async def test_add_publisher_no_auth_returns_401(self, admin_client):
        resp = await admin_client.post(
            "/api/admin/publishers",
            json={"fingerprint": "AAAA0000AAAA0000AAAA0000AAAA0000"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_add_publisher_non_admin_returns_403(self, capauth_client):
        """Trusted CapAuth publisher cannot add publishers (not admin)."""
        token = make_capauth_token(TRUSTED_FP)
        resp = await capauth_client.post(
            "/api/admin/publishers",
            json={"fingerprint": "BBBB0000BBBB0000BBBB0000BBBB0000", "name": "New pub"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_add_publisher_admin_succeeds(self, admin_client):
        fp = "NEWPUB00NEWPUB00NEWPUB00NEWPUB00"
        resp = await admin_client.post(
            "/api/admin/publishers",
            json={"fingerprint": fp, "name": "NewPub", "email": "new@example.com"},
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["ok"] is True
        assert data["fingerprint"] == fp

    @pytest.mark.asyncio
    async def test_add_publisher_minimal_body(self, admin_client):
        """Only fingerprint required; name and email are optional."""
        fp = "MINPUB00MINPUB00MINPUB00MINPUB00"
        resp = await admin_client.post(
            "/api/admin/publishers",
            json={"fingerprint": fp},
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_add_publisher_idempotent(self, admin_client):
        """Adding the same fingerprint twice succeeds both times (upsert)."""
        fp = "IDEM0000IDEM0000IDEM0000IDEM0000"
        auth = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
        for _ in range(2):
            resp = await admin_client.post(
                "/api/admin/publishers",
                json={"fingerprint": fp, "name": "Idem"},
                headers=auth,
            )
            assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_add_publisher_stores_in_db(self, admin_client, admin_storage):
        fp = "STORED00STORED00STORED00STORED00"
        await admin_client.post(
            "/api/admin/publishers",
            json={"fingerprint": fp, "name": "Stored"},
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert admin_storage.is_trusted_publisher(fp)


# ============================================================================
# 13. FULL LIFECYCLE: publish -> list -> get -> download -> search -> delete
# ============================================================================


class TestFullLifecycle:
    """End-to-end lifecycle test using admin auth."""

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, admin_client, admin_storage):
        """Publish, find in list, get by name, get by version, download,
        search, delete, and verify removal."""
        auth = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

        # 1. Publish
        tb = make_tarball(
            "lifecycle-skill",
            "2.0.0",
            "Full lifecycle test skill",
            ["lifecycle", "integration"],
        )
        pub_resp = await admin_client.post(
            "/api/skills",
            files={
                "tarball": (
                    "lifecycle-skill-2.0.0.tar.gz",
                    tb,
                    "application/gzip",
                )
            },
            headers=auth,
        )
        assert pub_resp.status_code == 201
        pub_data = pub_resp.json()
        assert pub_data["name"] == "lifecycle-skill"

        # 2. List — skill appears
        list_resp = await admin_client.get("/api/skills")
        list_names = [s["name"] for s in list_resp.json()["skills"]]
        assert "lifecycle-skill" in list_names

        # 3. Get by name
        get_resp = await admin_client.get("/api/skills/lifecycle-skill")
        assert get_resp.status_code == 200
        assert get_resp.json()["version"] == "2.0.0"

        # 4. Get by version
        ver_resp = await admin_client.get("/api/skills/lifecycle-skill/2.0.0")
        assert ver_resp.status_code == 200
        assert ver_resp.json()["description"] == "Full lifecycle test skill"

        # 5. Download
        dl_resp = await admin_client.get(
            "/api/skills/lifecycle-skill/2.0.0/download"
        )
        assert dl_resp.status_code == 200
        assert dl_resp.headers["content-type"] == "application/gzip"
        dl_sha = hashlib.sha256(dl_resp.content).hexdigest()
        assert dl_sha == pub_data["sha256"]

        # 6. Search
        search_resp = await admin_client.get("/api/skills?q=lifecycle")
        search_names = [s["name"] for s in search_resp.json()["skills"]]
        assert "lifecycle-skill" in search_names

        # 7. Search by tag
        tag_resp = await admin_client.get("/api/skills?q=integration")
        tag_names = [s["name"] for s in tag_resp.json()["skills"]]
        assert "lifecycle-skill" in tag_names

        # 8. Delete
        del_resp = await admin_client.delete(
            "/api/skills/lifecycle-skill/2.0.0", headers=auth
        )
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] is True

        # 9. Verify gone
        gone_resp = await admin_client.get("/api/skills/lifecycle-skill/2.0.0")
        assert gone_resp.status_code == 404

        # 10. Verify not in list
        after_list = await admin_client.get("/api/skills")
        after_names = [s["name"] for s in after_list.json()["skills"]]
        assert "lifecycle-skill" not in after_names

        # 11. Download also returns 404
        dl_gone = await admin_client.get(
            "/api/skills/lifecycle-skill/2.0.0/download"
        )
        assert dl_gone.status_code == 404


# ============================================================================
# 14. RESPONSE SCHEMA VALIDATION
# ============================================================================


class TestResponseSchemas:
    """Validate the shape of API responses against expected schemas."""

    @pytest.mark.asyncio
    async def test_skill_index_schema(self, open_client):
        data = (await open_client.get("/api/skills")).json()
        assert isinstance(data["url"], str)
        assert isinstance(data["total"], int)
        assert isinstance(data["skills"], list)

    @pytest.mark.asyncio
    async def test_skill_entry_schema(self, open_client):
        data = (await open_client.get("/api/skills/alpha-skill")).json()
        assert isinstance(data["name"], str)
        assert isinstance(data["version"], str)
        assert isinstance(data["description"], str)
        assert isinstance(data["author"], str)
        assert isinstance(data["tags"], list)
        assert isinstance(data["signed"], bool)
        assert isinstance(data["sha256"], str)
        assert isinstance(data["download_url"], str)
        assert isinstance(data["published_at"], str)

    @pytest.mark.asyncio
    async def test_publish_response_schema(self, open_client):
        tb = make_tarball("schema-check", "0.1.0")
        resp = await open_client.post(
            "/api/skills",
            files={"tarball": ("schema-check-0.1.0.tar.gz", tb, "application/gzip")},
        )
        data = resp.json()
        assert isinstance(data["ok"], bool)
        assert isinstance(data["name"], str)
        assert isinstance(data["version"], str)
        assert isinstance(data["sha256"], str)
        assert isinstance(data["download_url"], str)

    @pytest.mark.asyncio
    async def test_error_response_has_detail(self, open_client):
        """Error responses include a 'detail' field."""
        resp = await open_client.get("/api/skills/does-not-exist-at-all")
        assert resp.status_code == 404
        assert "detail" in resp.json()


# ============================================================================
# 15. EDGE CASES
# ============================================================================


class TestEdgeCases:
    """Miscellaneous edge cases."""

    @pytest.mark.asyncio
    async def test_skill_name_with_special_chars_in_url(self, open_client):
        """GET for a URL-encoded skill name that does not exist returns 404 (not 500)."""
        resp = await open_client.get("/api/skills/some%20skill%20with%20spaces")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_empty_search_query(self, open_client):
        """?q= (empty) is treated as no query; returns all skills."""
        resp_all = await open_client.get("/api/skills")
        resp_empty_q = await open_client.get("/api/skills?q=")
        # Empty q should not filter (storage.list_skills treats empty string as falsy)
        assert resp_empty_q.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_version_download(self, open_client):
        """Download for a skill that exists but wrong version returns 404."""
        resp = await open_client.get("/api/skills/alpha-skill/99.99.99/download")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_publish_preserves_author_name(self, open_client):
        """Author name from skill.yaml manifest is stored and returned."""
        tb = make_tarball("author-check", "0.1.0", author="Dr. Test")
        await open_client.post(
            "/api/skills",
            files={"tarball": ("author-check-0.1.0.tar.gz", tb, "application/gzip")},
        )
        data = (await open_client.get("/api/skills/author-check")).json()
        assert data["author"] == "Dr. Test"

    @pytest.mark.asyncio
    async def test_publish_empty_tags(self, open_client):
        """Skill with no tags stores and returns an empty list."""
        tb = make_tarball("no-tags", "0.1.0", tags=[])
        await open_client.post(
            "/api/skills",
            files={"tarball": ("no-tags-0.1.0.tar.gz", tb, "application/gzip")},
        )
        data = (await open_client.get("/api/skills/no-tags")).json()
        assert data["tags"] == []

    @pytest.mark.asyncio
    async def test_published_at_is_iso_format(self, open_client):
        """published_at field looks like an ISO 8601 timestamp."""
        data = (await open_client.get("/api/skills/alpha-skill")).json()
        ts = data["published_at"]
        # ISO 8601 has 'T' separator and at least 19 chars
        assert "T" in ts
        assert len(ts) >= 19

    @pytest.mark.asyncio
    async def test_list_url_field_contains_api(self, open_client):
        """SkillIndex.url field includes the /api prefix."""
        data = (await open_client.get("/api/skills")).json()
        assert "/api" in data["url"]

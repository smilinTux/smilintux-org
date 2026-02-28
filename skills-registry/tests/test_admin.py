"""Integration tests for admin endpoints.

Covers:
  POST /api/admin/publishers  — add trusted publisher (admin token required)
  DELETE /api/skills/{name}/{version} — delete a skill version (admin token required)

Tests run with REGISTRY_ADMIN_TOKEN set and REGISTRY_OPEN_PUBLISH unset,
so auth is fully enforced.
"""

from __future__ import annotations

import base64
import io
import json
import os
import tarfile

import pytest
import yaml
from httpx import ASGITransport, AsyncClient

ADMIN_TOKEN = "test-admin-secret-xyz"
PUBLISHER_FP = "AABB1234AABB1234AABB1234AABB1234"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def make_tarball(name: str, version: str, description: str = "test") -> bytes:
    """Build a minimal in-memory skill tarball."""
    manifest = {
        "name": name,
        "version": version,
        "description": description,
        "author": {"name": "test-author"},
        "tags": [],
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
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def tmp_storage(tmp_path_factory):
    """Isolated SkillStorage for admin tests."""
    from skills_registry.storage import SkillStorage

    base = tmp_path_factory.mktemp("admin_tests")
    return SkillStorage(db_path=base / "registry.db", packages_dir=base / "packages")


@pytest.fixture(scope="module")
async def client(tmp_storage):
    """Async test client with admin token auth and no open-publish mode."""
    # Ensure open publish is off; save original state for restore
    saved_open = os.environ.pop("REGISTRY_OPEN_PUBLISH", None)
    os.environ["REGISTRY_ADMIN_TOKEN"] = ADMIN_TOKEN

    from skills_registry.main import create_app, get_storage

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: tmp_storage

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    os.environ.pop("REGISTRY_ADMIN_TOKEN", None)
    if saved_open is not None:
        os.environ["REGISTRY_OPEN_PUBLISH"] = saved_open


# ---------------------------------------------------------------------------
# POST /api/admin/publishers — no auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_publisher_no_auth(client):
    """Missing Authorization header → 401."""
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": PUBLISHER_FP, "name": "Alice", "email": "alice@example.com"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_add_publisher_empty_bearer(client):
    """Empty Authorization header value → 403 (bearer present but invalid)."""
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": PUBLISHER_FP, "name": "Alice"},
        headers={"Authorization": "Bearer "},
    )
    # Empty token can't match admin or produce a fingerprint
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /api/admin/publishers — invalid / non-admin token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_publisher_invalid_token(client):
    """Garbage token (not CapAuth, not admin) → 403."""
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": PUBLISHER_FP, "name": "Alice"},
        headers={"Authorization": "Bearer not-a-valid-token-at-all"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_add_publisher_capauth_non_admin(client, tmp_storage):
    """Trusted CapAuth publisher (non-admin) → auth succeeds but admin check fails → 403."""
    # Pre-trust PUBLISHER_FP so the fingerprint check passes
    tmp_storage.add_trusted_publisher(
        fingerprint=PUBLISHER_FP, name="Bob", email="bob@example.com", trusted_by="admin"
    )
    token = make_capauth_token(PUBLISHER_FP)
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": "CCDD5678CCDD5678CCDD5678CCDD5678", "name": "Charlie"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert "admin" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_add_publisher_capauth_untrusted(client):
    """Untrusted CapAuth fingerprint → 403 (publisher not trusted)."""
    unknown_fp = "FFFF0000FFFF0000FFFF0000FFFF0000"
    token = make_capauth_token(unknown_fp)
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": "AAAA2222AAAA2222AAAA2222AAAA2222", "name": "Stranger"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/admin/publishers — admin token success
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_publisher_admin_token_ok(client):
    """Admin token → 201 with fingerprint echoed back."""
    new_fp = "EEFF9999EEFF9999EEFF9999EEFF9999"
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": new_fp, "name": "Dave", "email": "dave@example.com"},
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data["fingerprint"] == new_fp


@pytest.mark.asyncio
async def test_add_publisher_response_shape(client):
    """Admin response contains ok and fingerprint keys."""
    fp = "1234DEAD1234DEAD1234DEAD1234DEAD"
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": fp, "name": "Eve"},
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert set(data.keys()) >= {"ok", "fingerprint"}


@pytest.mark.asyncio
async def test_add_publisher_idempotent(client):
    """Adding the same publisher twice (upsert) both return 201."""
    fp = "AAAA1234AAAA1234AAAA1234AAAA1234"
    for _ in range(2):
        resp = await client.post(
            "/api/admin/publishers",
            json={"fingerprint": fp, "name": "Frankie"},
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
        assert resp.status_code == 201


@pytest.mark.asyncio
async def test_add_publisher_stores_in_db(client, tmp_storage):
    """Publisher added via endpoint is queryable in storage."""
    fp = "BBBB5678BBBB5678BBBB5678BBBB5678"
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": fp, "name": "Grace", "email": "grace@example.com"},
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 201
    assert tmp_storage.is_trusted_publisher(fp)


@pytest.mark.asyncio
async def test_add_publisher_minimal_body(client):
    """Only fingerprint required; name/email are optional."""
    fp = "CCCC7890CCCC7890CCCC7890CCCC7890"
    resp = await client.post(
        "/api/admin/publishers",
        json={"fingerprint": fp},
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 201
    assert resp.json()["fingerprint"] == fp


# ---------------------------------------------------------------------------
# DELETE /api/skills/{name}/{version} — no auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_skill_no_auth(client):
    """No Authorization header → 401."""
    resp = await client.delete("/api/skills/nonexistent/0.1.0")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/skills/{name}/{version} — invalid / non-admin token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_skill_invalid_token(client):
    """Garbage token → 403."""
    resp = await client.delete(
        "/api/skills/nonexistent/0.1.0",
        headers={"Authorization": "Bearer garbage"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_skill_capauth_non_admin(client, tmp_storage):
    """Trusted CapAuth publisher cannot delete (not admin) → 403."""
    token = make_capauth_token(PUBLISHER_FP)
    resp = await client.delete(
        "/api/skills/some-skill/0.1.0",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert "admin" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# DELETE /api/skills/{name}/{version} — admin + not found
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_skill_not_found(client):
    """Admin token + skill that doesn't exist → 404."""
    resp = await client.delete(
        "/api/skills/ghost-skill/9.9.9",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/skills/{name}/{version} — admin success
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_skill_ok(client, tmp_storage):
    """Publish a skill then delete it with admin token → 200."""
    tb = make_tarball("delete-me", "1.0.0")
    tmp_storage.publish_skill(
        name="delete-me",
        version="1.0.0",
        description="To be deleted",
        author="test",
        author_fingerprint="",
        tags=[],
        signed=False,
        signed_by="",
        tarball_bytes=tb,
        publisher_fingerprint="admin",
    )

    resp = await client.delete(
        "/api/skills/delete-me/1.0.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert "delete-me" in data["deleted"]


@pytest.mark.asyncio
async def test_delete_skill_response_shape(client, tmp_storage):
    """Delete response contains ok and deleted keys."""
    tb = make_tarball("shape-check", "0.5.0")
    tmp_storage.publish_skill(
        name="shape-check",
        version="0.5.0",
        description="Shape test",
        author="test",
        author_fingerprint="",
        tags=[],
        signed=False,
        signed_by="",
        tarball_bytes=tb,
        publisher_fingerprint="admin",
    )

    resp = await client.delete(
        "/api/skills/shape-check/0.5.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "ok" in data
    assert "deleted" in data
    assert data["ok"] is True


@pytest.mark.asyncio
async def test_delete_skill_gone_after_deletion(client, tmp_storage):
    """Deleted skill returns 404 on subsequent GET."""
    tb = make_tarball("vanishing-act", "2.0.0")
    tmp_storage.publish_skill(
        name="vanishing-act",
        version="2.0.0",
        description="Will vanish",
        author="test",
        author_fingerprint="",
        tags=[],
        signed=False,
        signed_by="",
        tarball_bytes=tb,
        publisher_fingerprint="admin",
    )

    del_resp = await client.delete(
        "/api/skills/vanishing-act/2.0.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert del_resp.status_code == 200

    get_resp = await client.get("/api/skills/vanishing-act/2.0.0")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_skill_second_time_is_404(client, tmp_storage):
    """Deleting the same skill twice: first succeeds, second is 404."""
    tb = make_tarball("twice-dead", "1.0.0")
    tmp_storage.publish_skill(
        name="twice-dead",
        version="1.0.0",
        description="Die twice",
        author="test",
        author_fingerprint="",
        tags=[],
        signed=False,
        signed_by="",
        tarball_bytes=tb,
        publisher_fingerprint="admin",
    )

    resp1 = await client.delete(
        "/api/skills/twice-dead/1.0.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp1.status_code == 200

    resp2 = await client.delete(
        "/api/skills/twice-dead/1.0.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_only_specific_version(client, tmp_storage):
    """Deleting one version does not affect other versions of the same skill."""
    for ver in ("3.0.0", "3.1.0"):
        tb = make_tarball("multi-ver", ver)
        tmp_storage.publish_skill(
            name="multi-ver",
            version=ver,
            description="Multi version skill",
            author="test",
            author_fingerprint="",
            tags=[],
            signed=False,
            signed_by="",
            tarball_bytes=tb,
            publisher_fingerprint="admin",
        )

    await client.delete(
        "/api/skills/multi-ver/3.0.0",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )

    # 3.1.0 should still be accessible
    resp = await client.get("/api/skills/multi-ver/3.1.0")
    assert resp.status_code == 200
    assert resp.json()["version"] == "3.1.0"

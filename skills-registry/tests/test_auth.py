"""Unit tests for skills_registry.auth — CapAuth authentication layer.

Tests cover:
  - _extract_fingerprint(): valid/invalid/malformed tokens
  - require_publisher(): open publish, no creds, admin token, CapAuth
"""

from __future__ import annotations

import base64
import json

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


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


def make_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class MockStorage:
    """Minimal storage stub for auth unit tests."""

    def __init__(self, trusted: list[str] | None = None) -> None:
        self._trusted: set[str] = set(trusted or [])

    def is_trusted_publisher(self, fingerprint: str) -> bool:
        return fingerprint in self._trusted


# ---------------------------------------------------------------------------
# _extract_fingerprint
# ---------------------------------------------------------------------------


def test_extract_fingerprint_valid():
    from skills_registry.auth import _extract_fingerprint

    fp = "ABCDEF1234567890ABCDEF1234567890"
    token = make_capauth_token(fp)
    assert _extract_fingerprint(token) == fp


def test_extract_fingerprint_no_fingerprint_field():
    from skills_registry.auth import _extract_fingerprint

    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "PGP"}).encode())
        .rstrip(b"=")
        .decode()
    )
    token = f"{header}.payload.sig"
    assert _extract_fingerprint(token) is None


def test_extract_fingerprint_not_base64():
    from skills_registry.auth import _extract_fingerprint

    assert _extract_fingerprint("not-valid!!..blah") is None


def test_extract_fingerprint_single_part():
    from skills_registry.auth import _extract_fingerprint

    assert _extract_fingerprint("onlyone") is None


def test_extract_fingerprint_empty_string():
    from skills_registry.auth import _extract_fingerprint

    assert _extract_fingerprint("") is None


def test_extract_fingerprint_two_parts_valid_header():
    """Two-part token (no sig) still has header — fingerprint extracted."""
    from skills_registry.auth import _extract_fingerprint

    fp = "DEADBEEF12345678DEADBEEF12345678"
    header = (
        base64.urlsafe_b64encode(
            json.dumps({"alg": "PGP", "fingerprint": fp}).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    token = f"{header}.payload"
    assert _extract_fingerprint(token) == fp


def test_extract_fingerprint_garbage_header():
    """Header that is valid base64 but not JSON."""
    from skills_registry.auth import _extract_fingerprint

    bad_header = base64.urlsafe_b64encode(b"not json !!!").rstrip(b"=").decode()
    assert _extract_fingerprint(f"{bad_header}.payload.sig") is None


# ---------------------------------------------------------------------------
# require_publisher — open publish mode
# ---------------------------------------------------------------------------


def test_require_publisher_open_publish(monkeypatch):
    monkeypatch.setenv("REGISTRY_OPEN_PUBLISH", "true")
    monkeypatch.delenv("REGISTRY_ADMIN_TOKEN", raising=False)

    from skills_registry.auth import require_publisher

    claims = require_publisher(credentials=None, storage=None)
    assert claims.fingerprint == "open"
    assert claims.is_admin is False


def test_require_publisher_open_publish_yes_value(monkeypatch):
    monkeypatch.setenv("REGISTRY_OPEN_PUBLISH", "yes")

    from skills_registry.auth import require_publisher

    claims = require_publisher(credentials=None, storage=None)
    assert claims.fingerprint == "open"


def test_require_publisher_open_publish_ignores_token(monkeypatch):
    """Open mode accepts any token — no validation."""
    monkeypatch.setenv("REGISTRY_OPEN_PUBLISH", "true")

    from skills_registry.auth import require_publisher

    creds = make_credentials("some-garbage-token")
    claims = require_publisher(credentials=creds, storage=None)
    assert claims.fingerprint == "open"
    assert claims.is_admin is False


def test_require_publisher_open_publish_false(monkeypatch):
    """REGISTRY_OPEN_PUBLISH=false does NOT enable open mode."""
    monkeypatch.setenv("REGISTRY_OPEN_PUBLISH", "false")
    monkeypatch.delenv("REGISTRY_ADMIN_TOKEN", raising=False)

    from skills_registry.auth import require_publisher

    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=None, storage=None)
    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# require_publisher — no credentials (401)
# ---------------------------------------------------------------------------


def test_require_publisher_no_creds_raises_401(monkeypatch):
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.delenv("REGISTRY_ADMIN_TOKEN", raising=False)

    from skills_registry.auth import require_publisher

    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=None, storage=None)
    assert exc_info.value.status_code == 401
    assert "WWW-Authenticate" in exc_info.value.headers


def test_require_publisher_no_creds_detail_message(monkeypatch):
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.delenv("REGISTRY_ADMIN_TOKEN", raising=False)

    from skills_registry.auth import require_publisher

    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=None, storage=None)
    assert "publish" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# require_publisher — admin token
# ---------------------------------------------------------------------------


def test_require_publisher_admin_token_valid(monkeypatch):
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "super-secret-admin-token")

    from skills_registry.auth import require_publisher

    creds = make_credentials("super-secret-admin-token")
    claims = require_publisher(credentials=creds, storage=None)
    assert claims.fingerprint == "admin"
    assert claims.is_admin is True


def test_require_publisher_admin_token_wrong_value(monkeypatch):
    """Wrong admin token falls through to CapAuth — garbage token → 403."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "correct-token")

    from skills_registry.auth import require_publisher

    creds = make_credentials("wrong-token")
    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=None)
    assert exc_info.value.status_code == 403


def test_require_publisher_admin_token_empty_env(monkeypatch):
    """Empty REGISTRY_ADMIN_TOKEN — admin check skipped, falls through to CapAuth."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "")

    from skills_registry.auth import require_publisher

    creds = make_credentials("some-token")
    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=None)
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# require_publisher — CapAuth fingerprint extraction failure (403)
# ---------------------------------------------------------------------------


def test_require_publisher_token_no_fingerprint_field(monkeypatch):
    """Valid base64 header JSON but missing fingerprint field → 403."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "PGP"}).encode())
        .rstrip(b"=")
        .decode()
    )
    creds = make_credentials(f"{header}.payload.sig")
    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=None)
    assert exc_info.value.status_code == 403
    assert "fingerprint" in exc_info.value.detail.lower()


def test_require_publisher_malformed_token(monkeypatch):
    """Token without any dots → 403."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    creds = make_credentials("completelyinvalidtoken")
    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=None)
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# require_publisher — CapAuth untrusted publisher (403)
# ---------------------------------------------------------------------------


def test_require_publisher_capauth_untrusted(monkeypatch):
    """Valid CapAuth token with fingerprint not in trusted publishers → 403."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    fp = "DEADBEEF1234567890DEADBEEF123456"
    creds = make_credentials(make_capauth_token(fp))
    storage = MockStorage(trusted=[])

    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=storage)
    assert exc_info.value.status_code == 403
    assert "not trusted" in exc_info.value.detail.lower()


def test_require_publisher_capauth_untrusted_detail_includes_partial_fp(monkeypatch):
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    fp = "CAFEBABE1234567890CAFEBABE123456"
    creds = make_credentials(make_capauth_token(fp))
    storage = MockStorage(trusted=[])

    with pytest.raises(HTTPException) as exc_info:
        require_publisher(credentials=creds, storage=storage)
    # Detail includes first 16 chars of fingerprint
    assert fp[:16] in exc_info.value.detail


# ---------------------------------------------------------------------------
# require_publisher — CapAuth trusted publisher (success)
# ---------------------------------------------------------------------------


def test_require_publisher_capauth_trusted(monkeypatch):
    """Valid CapAuth token with trusted fingerprint returns non-admin claims."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    fp = "CAFEBABE1234567890CAFEBABE123456"
    creds = make_credentials(make_capauth_token(fp))
    storage = MockStorage(trusted=[fp])

    claims = require_publisher(credentials=creds, storage=storage)
    assert claims.fingerprint == fp
    assert claims.is_admin is False


def test_require_publisher_capauth_trusted_multiple_publishers(monkeypatch):
    """Correct publisher is identified even when multiple are trusted."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    fp1 = "AAAA1111AAAA1111AAAA1111AAAA1111"
    fp2 = "BBBB2222BBBB2222BBBB2222BBBB2222"
    creds = make_credentials(make_capauth_token(fp2))
    storage = MockStorage(trusted=[fp1, fp2])

    claims = require_publisher(credentials=creds, storage=storage)
    assert claims.fingerprint == fp2


def test_require_publisher_capauth_no_storage_skips_db_check(monkeypatch):
    """storage=None skips the trusted-publisher DB check — fingerprint is returned."""
    monkeypatch.delenv("REGISTRY_OPEN_PUBLISH", raising=False)
    monkeypatch.setenv("REGISTRY_ADMIN_TOKEN", "admin-secret")

    from skills_registry.auth import require_publisher

    fp = "AABB1234567890AABB1234567890AABB"
    creds = make_credentials(make_capauth_token(fp))

    claims = require_publisher(credentials=creds, storage=None)
    assert claims.fingerprint == fp
    assert claims.is_admin is False

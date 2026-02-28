"""CapAuth authentication for the skills registry.

Authentication modes:
  1. Admin token — static secret from REGISTRY_ADMIN_TOKEN env var.
     Used for seeding trusted publishers and admin operations.
  2. CapAuth Bearer — JWT signed with the publisher's PGP key.
     Fingerprint extracted from token header, verified against trusted_publishers DB.
  3. Open publish — REGISTRY_OPEN_PUBLISH=true disables auth (dev/local only).

Header format:
  Authorization: Bearer <token>

CapAuth token format (JWT-like, PGP-signed):
  base64({"alg":"PGP","fingerprint":"ABCD..."}  ).base64(payload).base64(signature)
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("skills_registry.auth")

_bearer = HTTPBearer(auto_error=False)


def _admin_token() -> str:
    return os.environ.get("REGISTRY_ADMIN_TOKEN", "")


def _open_publish() -> bool:
    return os.environ.get("REGISTRY_OPEN_PUBLISH", "").lower() in ("1", "true", "yes")


def _extract_fingerprint(token: str) -> Optional[str]:
    """Extract PGP fingerprint from a CapAuth bearer token.

    The token header is base64(JSON) with an 'fingerprint' field.

    Returns:
        Fingerprint string or None if not a CapAuth token.
    """
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        header = json.loads(base64.urlsafe_b64decode(parts[0] + "=="))
        return header.get("fingerprint")
    except Exception:
        return None


class PublisherClaims:
    """Authenticated publisher identity extracted from a bearer token."""

    def __init__(self, fingerprint: str, is_admin: bool = False) -> None:
        self.fingerprint = fingerprint
        self.is_admin = is_admin


def require_publisher(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    storage=None,  # injected via Depends in main.py
) -> PublisherClaims:
    """FastAPI dependency: enforce publisher authentication.

    Raises:
        HTTPException 401: If no credentials are provided.
        HTTPException 403: If the credentials are invalid or untrusted.
    """
    # Open publish mode — allow anyone (dev only)
    if _open_publish():
        return PublisherClaims(fingerprint="open", is_admin=False)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to publish skills",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Check admin token first
    admin_token = _admin_token()
    if admin_token and token == admin_token:
        return PublisherClaims(fingerprint="admin", is_admin=True)

    # Check CapAuth fingerprint
    fingerprint = _extract_fingerprint(token)
    if not fingerprint:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token: could not extract CapAuth fingerprint",
        )

    # Fingerprint must be in trusted publishers
    if storage and not storage.is_trusted_publisher(fingerprint):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Publisher not trusted: {fingerprint[:16]}...",
        )

    return PublisherClaims(fingerprint=fingerprint, is_admin=False)

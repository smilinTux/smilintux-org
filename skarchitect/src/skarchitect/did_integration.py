"""Bridge CapAuth PGP identities to Ed25519 voting keys."""

from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from skarchitect.crypto import generate_keypair, public_key_to_did, SovereignKeypair


@dataclass
class DIDAttestation:
    """Links a PGP fingerprint to an Ed25519 voting key via signed attestation."""

    pgp_fingerprint: str
    ed25519_did: str
    ed25519_public_key_b64: str
    attestation_hash: str
    created_at: str


def create_attestation(
    pgp_fingerprint: str,
    keypair: Optional[SovereignKeypair] = None,
) -> tuple[DIDAttestation, SovereignKeypair]:
    """Create a DID attestation linking a PGP identity to a new Ed25519 key.

    Returns the attestation and the generated keypair.
    The attestation should be signed with the PGP key externally for full verification.
    """
    if keypair is None:
        keypair = generate_keypair()

    payload = {
        "type": "skarchitect-did-attestation",
        "pgp_fingerprint": pgp_fingerprint,
        "ed25519_did": keypair.did_key,
        "ed25519_public_key": keypair.public_key_b64,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    payload_bytes = json.dumps(payload, sort_keys=True).encode()
    attestation_hash = hashlib.sha256(payload_bytes).hexdigest()

    attestation = DIDAttestation(
        pgp_fingerprint=pgp_fingerprint,
        ed25519_did=keypair.did_key,
        ed25519_public_key_b64=keypair.public_key_b64,
        attestation_hash=attestation_hash,
        created_at=payload["timestamp"],
    )
    return attestation, keypair


def verify_attestation_hash(attestation: DIDAttestation) -> bool:
    """Verify the attestation hash is consistent."""
    payload = {
        "type": "skarchitect-did-attestation",
        "pgp_fingerprint": attestation.pgp_fingerprint,
        "ed25519_did": attestation.ed25519_did,
        "ed25519_public_key": attestation.ed25519_public_key_b64,
        "timestamp": attestation.created_at,
    }
    payload_bytes = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(payload_bytes).hexdigest() == attestation.attestation_hash

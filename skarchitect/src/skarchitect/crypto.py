"""Ed25519 cryptography for sovereign vote signing and verification."""

from __future__ import annotations

import base64
from dataclasses import dataclass

from nacl.encoding import RawEncoder
from nacl.signing import SigningKey, VerifyKey


# did:key multicodec prefix for Ed25519 public keys
_ED25519_MULTICODEC = b"\xed\x01"


@dataclass(frozen=True)
class SovereignKeypair:
    """An Ed25519 keypair with DID:key identity."""

    signing_key: SigningKey
    verify_key: VerifyKey
    did_key: str
    public_key_b64: str

    @property
    def private_key_bytes(self) -> bytes:
        return bytes(self.signing_key)

    @property
    def public_key_bytes(self) -> bytes:
        return bytes(self.verify_key)


def generate_keypair() -> SovereignKeypair:
    """Generate a new Ed25519 keypair with DID:key identity."""
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key
    did_key = public_key_to_did(bytes(verify_key))
    public_key_b64 = base64.b64encode(bytes(verify_key)).decode()
    return SovereignKeypair(
        signing_key=signing_key,
        verify_key=verify_key,
        did_key=did_key,
        public_key_b64=public_key_b64,
    )


def keypair_from_seed(seed: bytes) -> SovereignKeypair:
    """Restore a keypair from a 32-byte seed."""
    signing_key = SigningKey(seed)
    verify_key = signing_key.verify_key
    did_key = public_key_to_did(bytes(verify_key))
    public_key_b64 = base64.b64encode(bytes(verify_key)).decode()
    return SovereignKeypair(
        signing_key=signing_key,
        verify_key=verify_key,
        did_key=did_key,
        public_key_b64=public_key_b64,
    )


def public_key_to_did(public_key: bytes) -> str:
    """Convert a 32-byte Ed25519 public key to a did:key identifier."""
    multicodec_key = _ED25519_MULTICODEC + public_key
    encoded = base58_encode(multicodec_key)
    return f"did:key:z{encoded}"


def did_to_public_key(did_key: str) -> bytes:
    """Extract the 32-byte Ed25519 public key from a did:key identifier."""
    if not did_key.startswith("did:key:z"):
        raise ValueError(f"Invalid did:key format: {did_key}")
    decoded = base58_decode(did_key[len("did:key:z"):])
    if not decoded.startswith(_ED25519_MULTICODEC):
        raise ValueError("Not an Ed25519 did:key")
    return decoded[len(_ED25519_MULTICODEC):]


def sign_message(message: bytes, signing_key: SigningKey) -> bytes:
    """Sign a message, returning the 64-byte Ed25519 signature."""
    signed = signing_key.sign(message, encoder=RawEncoder)
    return signed.signature


def verify_signature(message: bytes, signature: bytes, public_key: bytes) -> bool:
    """Verify an Ed25519 signature. Returns True if valid, False otherwise."""
    verify_key = VerifyKey(public_key)
    try:
        verify_key.verify(message, signature, encoder=RawEncoder)
        return True
    except Exception:
        return False


# --- Base58 (Bitcoin alphabet) ---

_B58_ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def base58_encode(data: bytes) -> str:
    """Encode bytes to base58 (Bitcoin alphabet)."""
    n = int.from_bytes(data, "big")
    result = ""
    while n > 0:
        n, remainder = divmod(n, 58)
        result = _B58_ALPHABET[remainder:remainder + 1].decode() + result
    # Preserve leading zero bytes
    for byte in data:
        if byte == 0:
            result = "1" + result
        else:
            break
    return result or "1"


def base58_decode(s: str) -> bytes:
    """Decode a base58 string to bytes."""
    n = 0
    for char in s:
        n = n * 58 + _B58_ALPHABET.index(char.encode())
    result = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    # Preserve leading '1's as zero bytes
    pad = 0
    for char in s:
        if char == "1":
            pad += 1
        else:
            break
    return b"\x00" * pad + result

"""Shared fixtures for cross-package integration tests.

These tests verify the full sovereign agent stack works end-to-end:
CapAuth identity -> SKChat crypto -> SKComm transport -> SKMemory history.

All fixtures use temporary directories so tests are isolated and repeatable.
"""

from __future__ import annotations

from pathlib import Path

import pytest

pgpy = pytest.importorskip("pgpy", reason="pgpy is not installed")
from pgpy.constants import (  # noqa: E402
    HashAlgorithm,
    KeyFlags,
    PubKeyAlgorithm,
    SymmetricKeyAlgorithm,
)

PASSPHRASE = "sovereign-test-key-2026"


def _generate_keypair(name: str, email: str) -> tuple[str, str]:
    """Generate an RSA-2048 PGP keypair for testing.

    Args:
        name: UID display name.
        email: UID email.

    Returns:
        tuple[str, str]: (private_armor, public_armor).
    """
    key = pgpy.PGPKey.new(PubKeyAlgorithm.RSAEncryptOrSign, 2048)
    uid = pgpy.PGPUID.new(name, email=email)
    key.add_uid(
        uid,
        usage={KeyFlags.Sign, KeyFlags.Certify},
        hashes=[HashAlgorithm.SHA256],
        ciphers=[SymmetricKeyAlgorithm.AES256],
    )
    enc_subkey = pgpy.PGPKey.new(PubKeyAlgorithm.RSAEncryptOrSign, 2048)
    key.add_subkey(
        enc_subkey,
        usage={KeyFlags.EncryptCommunications, KeyFlags.EncryptStorage},
    )
    key.protect(PASSPHRASE, SymmetricKeyAlgorithm.AES256, HashAlgorithm.SHA256)
    return str(key), str(key.pubkey)


@pytest.fixture(scope="session")
def alice_keys() -> tuple[str, str]:
    """Alice's PGP keypair (session-scoped for speed)."""
    return _generate_keypair("Alice", "alice@skworld.io")


@pytest.fixture(scope="session")
def bob_keys() -> tuple[str, str]:
    """Bob's PGP keypair (session-scoped for speed)."""
    return _generate_keypair("Bob", "bob@skworld.io")


@pytest.fixture()
def shared_filedrop(tmp_path: Path) -> tuple[Path, Path]:
    """Shared filesystem directories simulating a file transport link.

    Returns:
        tuple[Path, Path]: (alice_outbox which is bob_inbox, bob_outbox which is alice_inbox).
    """
    alice_to_bob = tmp_path / "alice-to-bob"
    bob_to_alice = tmp_path / "bob-to-alice"
    alice_to_bob.mkdir()
    bob_to_alice.mkdir()
    return alice_to_bob, bob_to_alice

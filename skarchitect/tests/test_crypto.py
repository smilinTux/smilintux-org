"""Tests for Ed25519 crypto operations."""

from skarchitect.crypto import (
    base58_decode,
    base58_encode,
    did_to_public_key,
    generate_keypair,
    keypair_from_seed,
    public_key_to_did,
    sign_message,
    verify_signature,
)


def test_generate_keypair():
    kp = generate_keypair()
    assert kp.did_key.startswith("did:key:z")
    assert len(kp.public_key_bytes) == 32
    assert len(kp.private_key_bytes) == 32
    assert kp.public_key_b64


def test_keypair_from_seed_deterministic():
    kp1 = generate_keypair()
    seed = kp1.private_key_bytes[:32]
    kp2 = keypair_from_seed(seed)
    assert kp1.did_key == kp2.did_key
    assert kp1.public_key_b64 == kp2.public_key_b64


def test_did_roundtrip():
    kp = generate_keypair()
    pub = did_to_public_key(kp.did_key)
    assert pub == kp.public_key_bytes
    did2 = public_key_to_did(pub)
    assert did2 == kp.did_key


def test_sign_verify():
    kp = generate_keypair()
    msg = b"skarchitect:test:payload"
    sig = sign_message(msg, kp.signing_key)
    assert len(sig) == 64
    assert verify_signature(msg, sig, kp.public_key_bytes)


def test_verify_wrong_key():
    kp1 = generate_keypair()
    kp2 = generate_keypair()
    msg = b"test"
    sig = sign_message(msg, kp1.signing_key)
    assert not verify_signature(msg, sig, kp2.public_key_bytes)


def test_verify_tampered_message():
    kp = generate_keypair()
    sig = sign_message(b"original", kp.signing_key)
    assert not verify_signature(b"tampered", sig, kp.public_key_bytes)


def test_base58_roundtrip():
    data = b"\x00\x01\x02hello"
    encoded = base58_encode(data)
    decoded = base58_decode(encoded)
    assert decoded == data


def test_invalid_did():
    import pytest

    with pytest.raises(ValueError):
        did_to_public_key("not-a-did")
    with pytest.raises(ValueError):
        did_to_public_key("did:key:invalid")

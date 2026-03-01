"""End-to-end integration tests: CapAuth → Authentik login chain.

Tests the complete passwordless PGP authentication flow without requiring
a live Authentik/Django stack — all logic under test is framework-independent:

  1. NonceStore: issue, peek, consume, replay-protection
  2. Canonical payloads: deterministic byte strings for signing/verifying
  3. build_challenge(): issue nonce, produce challenge dict
  4. verify_auth_response(): consume nonce + verify PGP signatures + map OIDC
  5. Full login chain: identity → challenge → client signs → server verifies → claims

No mocks. Real PGP signing via PGPy backend. Real nonce store (in-process).
"""

from __future__ import annotations

import base64
import json

import pytest

pytest.importorskip("capauth", reason="capauth is not installed")
pytest.importorskip("pgpy", reason="pgpy is not installed")

PASSPHRASE = "sovereign-test-key-2026"
SERVICE_ID = "authentik.test.skworld.io"


class TestNonceStore:
    """Verify in-process nonce store issue/consume/replay semantics."""

    def test_issue_returns_valid_nonce_record(self, alice_keys: tuple[str, str]) -> None:
        """issue() returns a dict with nonce, fingerprint, timestamps."""
        from capauth.authentik.nonce_store import issue

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        record = issue(fp, client_nonce_echo="dGVzdC1ub25jZQ==")
        assert "nonce" in record
        assert "issued_at" in record
        assert "expires_at" in record
        assert record["fingerprint"] == fp
        assert record["used"] is False

    def test_consume_succeeds_first_time(self, alice_keys: tuple[str, str]) -> None:
        """Nonce can be consumed exactly once."""
        from capauth.authentik.nonce_store import consume, issue

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        record = issue(fp)
        ok, err = consume(record["nonce"], fp)
        assert ok is True
        assert err == ""

    def test_replay_attack_blocked(self, alice_keys: tuple[str, str]) -> None:
        """Consuming the same nonce twice is rejected."""
        from capauth.authentik.nonce_store import consume, issue

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        record = issue(fp)
        consume(record["nonce"], fp)  # First consume
        ok, err = consume(record["nonce"], fp)  # Replay attempt
        assert ok is False
        assert err == "invalid_nonce"

    def test_wrong_fingerprint_rejected(self, alice_keys: tuple[str, str], bob_keys: tuple[str, str]) -> None:
        """Nonce issued for Alice cannot be consumed by Bob."""
        from capauth.authentik.nonce_store import consume, issue

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        _, bob_pub = bob_keys
        alice_fp = get_backend().fingerprint_from_armor(alice_pub)
        bob_fp = get_backend().fingerprint_from_armor(bob_pub)

        record = issue(alice_fp)
        ok, err = consume(record["nonce"], bob_fp)
        assert ok is False

    def test_peek_reads_without_consuming(self, alice_keys: tuple[str, str]) -> None:
        """peek() reads nonce record without marking it used."""
        from capauth.authentik.nonce_store import consume, issue, peek

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        record = issue(fp)
        peeked = peek(record["nonce"])
        assert peeked is not None
        assert peeked["used"] is False

        # Nonce still consumable after peek
        ok, err = consume(record["nonce"], fp)
        assert ok is True


class TestCanonicalPayloads:
    """Verify canonical payload construction is deterministic."""

    def test_nonce_payload_deterministic(self) -> None:
        """Same inputs always produce the same canonical nonce bytes."""
        from capauth.authentik.verifier import canonical_nonce_payload

        p1 = canonical_nonce_payload(
            nonce="abc-def",
            client_nonce_echo="dGVzdA==",
            timestamp="2026-02-27T12:00:00+00:00",
            service=SERVICE_ID,
            expires="2026-02-27T12:01:00+00:00",
        )
        p2 = canonical_nonce_payload(
            nonce="abc-def",
            client_nonce_echo="dGVzdA==",
            timestamp="2026-02-27T12:00:00+00:00",
            service=SERVICE_ID,
            expires="2026-02-27T12:01:00+00:00",
        )
        assert p1 == p2
        assert p1.startswith(b"CAPAUTH_NONCE_V1")

    def test_claims_payload_deterministic(self) -> None:
        """Claims payload uses sorted JSON keys for reproducibility."""
        from capauth.authentik.verifier import canonical_claims_payload

        claims = {"email": "alice@skworld.io", "name": "Alice", "sub": "alice-fp"}
        p1 = canonical_claims_payload("A" * 40, "nonce-123", claims)
        # Same claims, different dict order should produce same bytes
        claims_reordered = {"sub": "alice-fp", "name": "Alice", "email": "alice@skworld.io"}
        p2 = canonical_claims_payload("A" * 40, "nonce-123", claims_reordered)
        assert p1 == p2
        assert p1.startswith(b"CAPAUTH_CLAIMS_V1")

    def test_nonce_payload_includes_all_fields(self) -> None:
        """Canonical nonce payload includes all expected fields."""
        from capauth.authentik.verifier import canonical_nonce_payload

        payload = canonical_nonce_payload(
            nonce="test-nonce",
            client_nonce_echo="client-echo",
            timestamp="ts",
            service="svc",
            expires="exp",
        )
        decoded = payload.decode("utf-8")
        assert "nonce=test-nonce" in decoded
        assert "client_nonce=client-echo" in decoded
        assert "service=svc" in decoded


class TestBuildChallenge:
    """Verify build_challenge() produces a valid challenge structure."""

    def test_build_challenge_structure(self, alice_keys: tuple[str, str]) -> None:
        """build_challenge() returns required fields including nonce and timestamps."""
        from capauth.authentik.stage import build_challenge

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        client_nonce = base64.b64encode(b"test-client-nonce").decode("ascii")
        challenge = build_challenge(
            fingerprint=fp,
            client_nonce_b64=client_nonce,
            service_id=SERVICE_ID,
            server_key_armor="",  # No server signing key for this test
            server_key_passphrase="",
        )

        assert challenge["capauth_version"] == "1.0"
        assert "nonce" in challenge
        assert challenge["service"] == SERVICE_ID
        assert challenge["client_nonce_echo"] == client_nonce
        assert "issued_at" not in challenge  # Not exposed directly
        assert challenge["nonce"] != ""

    def test_build_challenge_nonce_is_unique(self, alice_keys: tuple[str, str]) -> None:
        """Each build_challenge() call produces a different nonce."""
        from capauth.authentik.stage import build_challenge

        from capauth.crypto import get_backend
        _, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        c1 = build_challenge(fp, "echo1", SERVICE_ID, "", "")
        c2 = build_challenge(fp, "echo2", SERVICE_ID, "", "")
        assert c1["nonce"] != c2["nonce"]


class TestVerifyAuthResponse:
    """Full verify_auth_response() with real PGP signatures."""

    def _sign_payload(self, payload: bytes, priv_key: str) -> str:
        """Sign bytes with a PGP private key and return armored signed message."""
        import pgpy

        key, _ = pgpy.PGPKey.from_blob(priv_key)
        with key.unlock(PASSPHRASE):
            msg = pgpy.PGPMessage.new(payload, cleartext=False)
            sig = key.sign(msg)
            msg |= sig
        return str(msg)

    def test_verify_auth_response_succeeds(self, alice_keys: tuple[str, str]) -> None:
        """Full flow: build challenge → sign nonce → verify_auth_response returns True."""
        from capauth.authentik.stage import build_challenge, verify_auth_response
        from capauth.authentik.verifier import canonical_nonce_payload

        from capauth.crypto import get_backend
        alice_priv, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        # Build challenge (issues nonce)
        client_nonce = base64.b64encode(b"sovereign-client-nonce").decode("ascii")
        challenge = build_challenge(
            fingerprint=fp,
            client_nonce_b64=client_nonce,
            service_id=SERVICE_ID,
            server_key_armor="",
            server_key_passphrase="",
        )

        # Build the canonical nonce payload the client would sign
        nonce_payload = canonical_nonce_payload(
            nonce=challenge["nonce"],
            client_nonce_echo=challenge["client_nonce_echo"],
            timestamp=challenge["timestamp"],
            service=challenge["service"],
            expires=challenge["expires"],
        )

        # Client signs the nonce payload
        nonce_sig = self._sign_payload(nonce_payload, alice_priv)

        # Verify (no claims for anonymous auth)
        success, err, oidc = verify_auth_response(
            fingerprint=fp,
            nonce_id=challenge["nonce"],
            nonce_signature_armor=nonce_sig,
            claims={},
            claims_signature_armor="",
            public_key_armor=alice_pub,
            challenge_context=challenge,
        )

        assert success is True, f"verify_auth_response failed: {err}"
        assert err == ""

    def test_verify_auth_response_with_claims(self, alice_keys: tuple[str, str]) -> None:
        """Full flow with claims: nonce + claims both signed → OIDC claims returned."""
        from capauth.authentik.stage import build_challenge, verify_auth_response
        from capauth.authentik.verifier import canonical_claims_payload, canonical_nonce_payload

        from capauth.crypto import get_backend
        alice_priv, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        client_nonce = base64.b64encode(b"claims-test-nonce").decode("ascii")
        challenge = build_challenge(
            fingerprint=fp,
            client_nonce_b64=client_nonce,
            service_id=SERVICE_ID,
            server_key_armor="",
            server_key_passphrase="",
        )

        nonce_payload = canonical_nonce_payload(
            nonce=challenge["nonce"],
            client_nonce_echo=challenge["client_nonce_echo"],
            timestamp=challenge["timestamp"],
            service=challenge["service"],
            expires=challenge["expires"],
        )
        nonce_sig = self._sign_payload(nonce_payload, alice_priv)

        claims = {"name": "Alice Sovereign", "email": "alice@skworld.io"}
        claims_payload = canonical_claims_payload(
            fingerprint=fp,
            nonce=challenge["nonce"],
            claims=claims,
        )
        claims_sig = self._sign_payload(claims_payload, alice_priv)

        success, err, oidc = verify_auth_response(
            fingerprint=fp,
            nonce_id=challenge["nonce"],
            nonce_signature_armor=nonce_sig,
            claims=claims,
            claims_signature_armor=claims_sig,
            public_key_armor=alice_pub,
            challenge_context=challenge,
        )

        assert success is True, f"Claims verification failed: {err}"
        assert "alice@skworld.io" in json.dumps(oidc)
        assert oidc.get("sub") == fp  # fingerprint maps to sub

    def test_wrong_key_signature_rejected(self, alice_keys: tuple[str, str], bob_keys: tuple[str, str]) -> None:
        """Nonce signed by Bob cannot satisfy Alice's challenge."""
        from capauth.authentik.stage import build_challenge, verify_auth_response
        from capauth.authentik.verifier import canonical_nonce_payload

        from capauth.crypto import get_backend
        alice_priv, alice_pub = alice_keys
        bob_priv, _ = bob_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        client_nonce = base64.b64encode(b"wrong-key-test").decode("ascii")
        challenge = build_challenge(
            fingerprint=fp,
            client_nonce_b64=client_nonce,
            service_id=SERVICE_ID,
            server_key_armor="",
            server_key_passphrase="",
        )

        nonce_payload = canonical_nonce_payload(
            nonce=challenge["nonce"],
            client_nonce_echo=challenge["client_nonce_echo"],
            timestamp=challenge["timestamp"],
            service=challenge["service"],
            expires=challenge["expires"],
        )
        # Bob signs Alice's challenge — should fail verification
        bob_nonce_sig = self._sign_payload(nonce_payload, bob_priv)

        success, err, _ = verify_auth_response(
            fingerprint=fp,
            nonce_id=challenge["nonce"],
            nonce_signature_armor=bob_nonce_sig,
            claims={},
            claims_signature_armor="",
            public_key_armor=alice_pub,
            challenge_context=challenge,
        )

        assert success is False
        assert err in ("invalid_nonce_signature", "invalid_nonce")

    def test_replay_challenge_rejected(self, alice_keys: tuple[str, str]) -> None:
        """Replaying a consumed challenge nonce is rejected."""
        from capauth.authentik.stage import build_challenge, verify_auth_response
        from capauth.authentik.verifier import canonical_nonce_payload

        from capauth.crypto import get_backend
        alice_priv, alice_pub = alice_keys
        fp = get_backend().fingerprint_from_armor(alice_pub)

        client_nonce = base64.b64encode(b"replay-test-nonce").decode("ascii")
        challenge = build_challenge(
            fingerprint=fp,
            client_nonce_b64=client_nonce,
            service_id=SERVICE_ID,
            server_key_armor="",
            server_key_passphrase="",
        )

        nonce_payload = canonical_nonce_payload(
            nonce=challenge["nonce"],
            client_nonce_echo=challenge["client_nonce_echo"],
            timestamp=challenge["timestamp"],
            service=challenge["service"],
            expires=challenge["expires"],
        )
        nonce_sig = self._sign_payload(nonce_payload, alice_priv)

        # First auth — succeeds
        success1, _, _ = verify_auth_response(
            fingerprint=fp,
            nonce_id=challenge["nonce"],
            nonce_signature_armor=nonce_sig,
            claims={},
            claims_signature_armor="",
            public_key_armor=alice_pub,
            challenge_context=challenge,
        )
        assert success1 is True

        # Replay — fails
        success2, err2, _ = verify_auth_response(
            fingerprint=fp,
            nonce_id=challenge["nonce"],
            nonce_signature_armor=nonce_sig,
            claims={},
            claims_signature_armor="",
            public_key_armor=alice_pub,
            challenge_context=challenge,
        )
        assert success2 is False
        assert "nonce" in err2

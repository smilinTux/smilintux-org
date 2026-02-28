"""End-to-end integration tests: SKSeal → PDF signing full flow.

Tests the complete PDF document signing lifecycle:
  1. SKSeal: hash PDF bytes (SHA-256)
  2. SKSeal: sign with CapAuth-generated PGP keys including field values
  3. SKSeal: verify individual signature record with PDF hash integrity
  4. SKSeal: verify_document() all signatures at once
  5. SKSeal: seal_document() creates tamper-evident final envelope
  6. SKSeal: verify_seal() validates the complete sealed document
  7. DocumentStore: persist, reload, and re-verify after serialization

No mocks. Real PGP signatures. Real SHA-256 hashes. Real JSON persistence.
"""

from __future__ import annotations

from pathlib import Path

import pytest

PASSPHRASE = "sovereign-test-key-2026"

# Realistic multi-page PDF header (parseable minimal PDF)
SAMPLE_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
    b"%%EOF"
)

# A different PDF to test hash-mismatch detection
MODIFIED_PDF = SAMPLE_PDF + b"\n% tampered"


class TestSKSealPDFHashChain:
    """Verify SHA-256 hash chain integrity for PDF document signing."""

    def test_hash_bytes_is_deterministic(self) -> None:
        """Same PDF bytes always produce the same SHA-256 hash."""
        from skseal.engine import SealEngine

        engine = SealEngine()
        h1 = engine.hash_bytes(SAMPLE_PDF)
        h2 = engine.hash_bytes(SAMPLE_PDF)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex digest

    def test_hash_file_matches_hash_bytes(self, tmp_path: Path) -> None:
        """hash_file() and hash_bytes() produce identical results."""
        from skseal.engine import SealEngine

        engine = SealEngine()
        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(SAMPLE_PDF)

        assert engine.hash_bytes(SAMPLE_PDF) == engine.hash_file(pdf_path)

    def test_signature_invalidated_by_pdf_modification(
        self,
        alice_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Signature verified against original PDF fails with modified PDF."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        fp = backend.fingerprint_from_armor(alice_pub)

        signer = Signer(
            name="Alice",
            email="alice@skworld.io",
            fingerprint=fp,
            role=SignerRole.SIGNER,
            status=SignerStatus.PENDING,
        )
        doc = Document(
            title="Hash Integrity Test",
            description="Detect tampering via hash",
            signers=[signer],
        )

        engine = SealEngine()
        signed = engine.sign_document(
            document=doc,
            signer_id=signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )
        record = signed.signatures[-1]

        # Signature verifies against original PDF
        assert engine.verify_signature(record, alice_pub, pdf_data=SAMPLE_PDF) is True

        # Modified PDF fails hash check
        assert engine.verify_signature(record, alice_pub, pdf_data=MODIFIED_PDF) is False


class TestSKSealFieldValues:
    """Verify field values are embedded in signature records."""

    def test_field_values_stored_in_signature_record(
        self,
        alice_keys: tuple[str, str],
    ) -> None:
        """Field values provided at signing time are retrievable in SignatureRecord."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        fp = backend.fingerprint_from_armor(alice_pub)

        signer = Signer(
            name="Alice",
            email="alice@skworld.io",
            fingerprint=fp,
            role=SignerRole.SIGNER,
            status=SignerStatus.PENDING,
        )
        doc = Document(
            title="Field Values Test",
            description="Check field_values persistence",
            signers=[signer],
        )

        field_values = {
            "full_name": "Alice Sovereign",
            "date": "2026-02-27",
            "company": "SKWorld Foundation",
        }

        engine = SealEngine()
        signed = engine.sign_document(
            document=doc,
            signer_id=signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
            field_values=field_values,
        )

        record = signed.signatures[-1]
        assert record.field_values["full_name"] == "Alice Sovereign"
        assert record.field_values["date"] == "2026-02-27"
        assert record.field_values["company"] == "SKWorld Foundation"

    def test_ip_and_user_agent_stored(
        self,
        alice_keys: tuple[str, str],
    ) -> None:
        """IP address and user agent are captured in signature record and audit."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        fp = backend.fingerprint_from_armor(alice_pub)

        signer = Signer(
            name="Alice",
            email="alice@skworld.io",
            fingerprint=fp,
            role=SignerRole.SIGNER,
            status=SignerStatus.PENDING,
        )
        doc = Document(
            title="Metadata Test Document",
            description="Verify IP and UA capture",
            signers=[signer],
        )

        engine = SealEngine()
        signed = engine.sign_document(
            document=doc,
            signer_id=signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
            ip_address="192.168.1.42",
            user_agent="CapAuth-CLI/1.0",
        )

        record = signed.signatures[-1]
        assert record.ip_address == "192.168.1.42"
        assert record.user_agent == "CapAuth-CLI/1.0"


class TestSKSealVerifyDocument:
    """Verify verify_document() validates all signatures at once."""

    def test_verify_document_all_signers(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
    ) -> None:
        """verify_document returns True for all signers after each has signed."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_fp = backend.fingerprint_from_armor(alice_pub)
        bob_fp = backend.fingerprint_from_armor(bob_pub)

        alice_signer = Signer(
            name="Alice",
            email="alice@skworld.io",
            fingerprint=alice_fp,
            role=SignerRole.SIGNER,
            status=SignerStatus.PENDING,
        )
        bob_signer = Signer(
            name="Bob",
            email="bob@skworld.io",
            fingerprint=bob_fp,
            role=SignerRole.COSIGNER,
            status=SignerStatus.PENDING,
        )
        doc = Document(
            title="Multi-Signer Verification",
            description="Both parties sign",
            signers=[alice_signer, bob_signer],
        )

        engine = SealEngine()
        doc = engine.sign_document(
            document=doc,
            signer_id=alice_signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )
        doc = engine.sign_document(
            document=doc,
            signer_id=bob_signer.signer_id,
            private_key_armor=bob_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )

        public_keys = {alice_fp: alice_pub, bob_fp: bob_pub}
        results = engine.verify_document(doc, public_keys, pdf_data=SAMPLE_PDF)

        assert results[alice_signer.signer_id] is True
        assert results[bob_signer.signer_id] is True

    def test_document_status_completed_after_all_sign(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
    ) -> None:
        """Document transitions to COMPLETED when all signers have signed."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, DocumentStatus, Signer, SignerRole, SignerStatus

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_fp = backend.fingerprint_from_armor(alice_pub)
        bob_fp = backend.fingerprint_from_armor(bob_pub)

        signers = [
            Signer(name="Alice", email="alice@skworld.io", fingerprint=alice_fp,
                   role=SignerRole.SIGNER, status=SignerStatus.PENDING),
            Signer(name="Bob", email="bob@skworld.io", fingerprint=bob_fp,
                   role=SignerRole.COSIGNER, status=SignerStatus.PENDING),
        ]
        doc = Document(
            title="Completion Status Test",
            description="Status transitions",
            signers=signers,
        )

        engine = SealEngine()
        doc = engine.sign_document(
            document=doc, signer_id=signers[0].signer_id,
            private_key_armor=alice_priv, passphrase=PASSPHRASE, pdf_data=SAMPLE_PDF,
        )
        # After first signer only: PARTIALLY_SIGNED
        assert doc.status == DocumentStatus.PARTIALLY_SIGNED

        doc = engine.sign_document(
            document=doc, signer_id=signers[1].signer_id,
            private_key_armor=bob_priv, passphrase=PASSPHRASE, pdf_data=SAMPLE_PDF,
        )
        # After all signers: COMPLETED
        assert doc.status == DocumentStatus.COMPLETED
        assert doc.completed_at is not None


class TestSKSealFullDocumentLifecycle:
    """Full pipeline: sign → verify → seal → verify_seal → persist → reload."""

    def test_sign_seal_verify_persist_reload(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Complete lifecycle: two signers, seal, persist, reload, re-verify."""
        from capauth.crypto import get_backend
        from skseal.engine import SealEngine
        from skseal.models import (
            AuditAction,
            Document,
            DocumentStatus,
            Signer,
            SignerRole,
            SignerStatus,
        )
        from skseal.store import DocumentStore

        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_fp = backend.fingerprint_from_armor(alice_pub)
        bob_fp = backend.fingerprint_from_armor(bob_pub)

        alice_signer = Signer(
            name="Alice",
            email="alice@skworld.io",
            fingerprint=alice_fp,
            role=SignerRole.SIGNER,
            status=SignerStatus.PENDING,
        )
        bob_signer = Signer(
            name="Bob",
            email="bob@skworld.io",
            fingerprint=bob_fp,
            role=SignerRole.COSIGNER,
            status=SignerStatus.PENDING,
        )
        doc = Document(
            title="Sovereign Partnership Agreement",
            description="Full lifecycle: sign, seal, persist",
            signers=[alice_signer, bob_signer],
        )

        engine = SealEngine()

        # --- Sign ---
        doc = engine.sign_document(
            document=doc,
            signer_id=alice_signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
            field_values={"role": "initiating_party"},
        )
        doc = engine.sign_document(
            document=doc,
            signer_id=bob_signer.signer_id,
            private_key_armor=bob_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
            field_values={"role": "co-signatory"},
        )
        assert doc.status == DocumentStatus.COMPLETED

        # --- Verify document-wide ---
        public_keys = {alice_fp: alice_pub, bob_fp: bob_pub}
        verify_results = engine.verify_document(doc, public_keys, pdf_data=SAMPLE_PDF)
        assert all(verify_results.values()), f"Verification failed: {verify_results}"

        # --- Seal ---
        seal_armor = engine.seal_document(doc, alice_priv, PASSPHRASE)
        assert "BEGIN PGP" in seal_armor

        # --- Verify seal ---
        assert engine.verify_seal(doc, seal_armor, alice_pub) is True
        assert engine.verify_seal(doc, seal_armor, bob_pub) is False  # Wrong key

        # --- Persist ---
        store = DocumentStore(base_dir=tmp_path / ".skseal")
        saved_path = store.save_document(doc)
        assert saved_path.exists()

        # --- Reload ---
        loaded = store.load_document(doc.document_id)
        assert loaded is not None
        assert loaded.title == "Sovereign Partnership Agreement"
        assert len(loaded.signatures) == 2
        assert loaded.status == DocumentStatus.COMPLETED

        # --- Re-verify after persistence ---
        reloaded_results = engine.verify_document(loaded, public_keys, pdf_data=SAMPLE_PDF)
        assert all(reloaded_results.values())

        # --- Audit trail ---
        signed_actions = [
            e for e in loaded.audit_trail if e.action == AuditAction.SIGNED
        ]
        completed_actions = [
            e for e in loaded.audit_trail if e.action == AuditAction.COMPLETED
        ]
        assert len(signed_actions) == 2
        assert len(completed_actions) == 1

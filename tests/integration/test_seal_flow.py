"""Integration tests: CapAuth identity + SKSeal document signing.

Tests the cross-package flow:
  1. CapAuth: generate PGP identity (keypair)
  2. SKSeal: sign a document with CapAuth-generated keys
  3. SKSeal: verify the signature with the public key
  4. SKSeal: seal a completed document

No mocks. Real crypto. Real PGP operations.
"""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("capauth", reason="capauth is not installed")
pytest.importorskip("skseal", reason="skseal is not installed")

PASSPHRASE = "sovereign-test-key-2026"

# Minimal valid PDF for signing tests.
SAMPLE_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF"


class TestCapAuthToSKSeal:
    """Verify CapAuth-generated keys work with SKSeal signing engine."""

    def test_sign_document_with_capauth_keys(
        self,
        alice_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Document signed with CapAuth key produces valid signature."""
        from capauth.crypto import get_backend as capauth_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = capauth_backend()
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
            title="Sovereign Partnership Agreement",
            description="Test document for integration",
            signers=[signer],
        )

        engine = SealEngine()

        signed_doc = engine.sign_document(
            document=doc,
            signer_id=signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )

        assert len(signed_doc.signatures) >= 1
        record = signed_doc.signatures[-1]
        assert record.fingerprint == fp
        assert record.signature_armor is not None
        assert "BEGIN PGP" in record.signature_armor

    def test_verify_signature_roundtrip(
        self,
        alice_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Signature created by CapAuth key verifies against public key."""
        from capauth.crypto import get_backend as capauth_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = capauth_backend()
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
            title="Verification Test Document",
            description="Round-trip signing verification",
            signers=[signer],
        )

        engine = SealEngine()

        signed_doc = engine.sign_document(
            document=doc,
            signer_id=signer.signer_id,
            private_key_armor=alice_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )

        record = signed_doc.signatures[-1]
        verified = engine.verify_signature(record, alice_pub)
        assert verified is True

    def test_multi_signer_document(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Two CapAuth identities can both sign the same document."""
        from capauth.crypto import get_backend as capauth_backend
        from skseal.engine import SealEngine
        from skseal.models import Document, Signer, SignerRole, SignerStatus

        backend = capauth_backend()
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
            title="Multi-Party Agreement",
            description="Requires both signatures",
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
        alice_record = doc.signatures[-1]

        doc = engine.sign_document(
            document=doc,
            signer_id=bob_signer.signer_id,
            private_key_armor=bob_priv,
            passphrase=PASSPHRASE,
            pdf_data=SAMPLE_PDF,
        )
        bob_record = doc.signatures[-1]

        assert engine.verify_signature(alice_record, alice_pub) is True
        assert engine.verify_signature(bob_record, bob_pub) is True

        # Cross-verify should fail
        assert engine.verify_signature(alice_record, bob_pub) is False


class TestSKSealDocumentStore:
    """Verify SKSeal document store operations work with real documents."""

    def test_store_and_retrieve_document(self, tmp_path: Path) -> None:
        """Documents stored via DocumentStore are retrievable."""
        from skseal.models import Document, Signer, SignerRole, SignerStatus
        from skseal.store import DocumentStore

        store = DocumentStore(base_dir=tmp_path / ".skseal")

        doc = Document(
            title="Stored Test Document",
            description="Testing persistence",
            signers=[
                Signer(
                    name="Test Signer",
                    email="test@skworld.io",
                    fingerprint="A" * 40,
                    role=SignerRole.SIGNER,
                    status=SignerStatus.PENDING,
                ),
            ],
        )

        saved_path = store.save_document(doc)
        assert saved_path.exists()

        loaded = store.load_document(doc.document_id)
        assert loaded is not None
        assert loaded.title == "Stored Test Document"
        assert len(loaded.signers) == 1

    def test_audit_trail_persists(self, tmp_path: Path) -> None:
        """Audit entries are appended and retrievable."""
        from skseal.models import AuditAction, AuditEntry, Document
        from skseal.store import DocumentStore

        store = DocumentStore(base_dir=tmp_path / ".skseal")

        doc = Document(title="Audit Test", description="Testing audit trail")
        store.save_document(doc)

        entry = AuditEntry(
            document_id=doc.document_id,
            action=AuditAction.CREATED,
            actor_name="test-agent",
            details="Document created for integration test",
        )
        store.append_audit(entry)

        trail = store.get_audit_trail(doc.document_id)
        assert len(trail) >= 1
        assert trail[0].action == AuditAction.CREATED

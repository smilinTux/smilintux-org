"""End-to-end integration tests: the full sovereign agent message flow.

Tests the complete stack wired together:
  1. CapAuth: generate PGP identity
  2. SKChat ChatCrypto: encrypt and sign messages
  3. SKComm FileTransport: deliver via filesystem
  4. SKMemory ChatHistory: persist and retrieve

No mocks. Real crypto. Real files. Real memory store.
Tool-agnostic: runs anywhere Python + pytest works.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

PASSPHRASE = "sovereign-test-key-2026"


class TestCapAuthIdentity:
    """Verify CapAuth identity generation works standalone."""

    def test_generate_identity_keypair(self, alice_keys: tuple[str, str]) -> None:
        """CapAuth generates a valid PGP keypair with signing + encryption."""
        priv, pub = alice_keys
        assert "BEGIN PGP PRIVATE KEY BLOCK" in priv
        assert "BEGIN PGP PUBLIC KEY BLOCK" in pub

    def test_fingerprint_extraction(self, alice_keys: tuple[str, str]) -> None:
        """CapAuth can extract fingerprint from generated keys."""
        from capauth.crypto import get_backend

        backend = get_backend()
        _, pub = alice_keys
        fp = backend.fingerprint_from_armor(pub)
        assert len(fp) == 40

    def test_challenge_response_flow(self, alice_keys: tuple[str, str]) -> None:
        """CapAuth challenge-response identity verification works end-to-end."""
        from capauth.crypto import get_backend
        from capauth.identity import (
            create_challenge,
            respond_to_challenge,
            verify_challenge,
        )

        priv, pub = alice_keys
        backend = get_backend()
        fp = backend.fingerprint_from_armor(pub)

        challenge = create_challenge(fp, fp)
        response = respond_to_challenge(challenge, priv, PASSPHRASE)
        assert verify_challenge(challenge, response, pub) is True


class TestSKChatCrypto:
    """Verify SKChat encryption works with CapAuth keys."""

    def test_encrypt_decrypt_with_capauth_keys(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
    ) -> None:
        """Message encrypted by Alice can be decrypted by Bob."""
        from skchat.crypto import ChatCrypto
        from skchat.models import ChatMessage

        alice_priv, _ = alice_keys
        bob_priv, bob_pub = bob_keys

        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        msg = ChatMessage(
            sender="capauth:alice@skworld.io",
            recipient="capauth:bob@skworld.io",
            content="Sovereignty is non-negotiable.",
        )

        encrypted = alice_crypto.encrypt_message(msg, bob_pub)
        assert encrypted.encrypted is True
        assert encrypted.content != msg.content

        decrypted = bob_crypto.decrypt_message(encrypted)
        assert decrypted.content == "Sovereignty is non-negotiable."

    def test_sign_verify_with_capauth_keys(
        self,
        alice_keys: tuple[str, str],
    ) -> None:
        """Message signed by Alice verifies against her public key."""
        from skchat.crypto import ChatCrypto
        from skchat.models import ChatMessage

        alice_priv, alice_pub = alice_keys
        crypto = ChatCrypto(alice_priv, PASSPHRASE)

        msg = ChatMessage(
            sender="capauth:alice@skworld.io",
            recipient="capauth:bob@skworld.io",
            content="Signed and sovereign.",
        )

        signed = crypto.sign_message(msg)
        assert ChatCrypto.verify_signature(signed, alice_pub) is True


class TestSKCommFileTransport:
    """Verify SKComm file transport delivers envelope bytes."""

    def test_send_receive_via_file_transport(
        self,
        shared_filedrop: tuple[Path, Path],
    ) -> None:
        """Envelope sent via file transport appears in receiver's inbox."""
        from skcomm.models import MessageEnvelope, MessagePayload
        from skcomm.transports.file import FileTransport

        # Reason: file transport writes .skc.json files to outbox.
        # Simulating filesystem sync: Alice's outbox IS Bob's inbox.
        alice_to_bob, bob_to_alice = shared_filedrop

        alice = FileTransport(outbox_path=alice_to_bob, inbox_path=bob_to_alice, archive=False)
        bob = FileTransport(outbox_path=bob_to_alice, inbox_path=alice_to_bob, archive=False)

        envelope = MessageEnvelope(
            sender="alice",
            recipient="bob",
            payload=MessagePayload(content="File transport works!"),
        )

        result = alice.send(envelope.to_bytes(), "bob")
        assert result.success is True

        received = bob.receive()
        assert len(received) == 1

        env = MessageEnvelope.from_bytes(received[0])
        assert env.payload.content == "File transport works!"


class TestSKMemoryChatHistory:
    """Verify SKMemory stores and retrieves chat messages."""

    def test_store_and_retrieve_message(self, tmp_path: Path) -> None:
        """ChatMessage stored via ChatHistory is retrievable by thread."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.history import ChatHistory
        from skchat.models import ChatMessage

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        msg = ChatMessage(
            sender="capauth:alice@skworld.io",
            recipient="capauth:bob@skworld.io",
            content="Stored in sovereign memory.",
            thread_id="thread-e2e",
        )
        mem_id = history.store_message(msg)
        assert mem_id is not None

        thread_msgs = history.get_thread_messages("thread-e2e")
        assert len(thread_msgs) == 1
        assert thread_msgs[0]["content"] == "Stored in sovereign memory."

    def test_search_across_messages(self, tmp_path: Path) -> None:
        """Full-text search finds messages stored in SKMemory."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.history import ChatHistory
        from skchat.models import ChatMessage

        backend = SQLiteBackend(base_path=str(tmp_path / "search"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        for text in ["quantum upgrade ready", "deploy the build", "sovereignty forever"]:
            history.store_message(ChatMessage(
                sender="capauth:alice@skworld.io",
                recipient="capauth:bob@skworld.io",
                content=text,
            ))

        results = history.search_messages("quantum")
        assert len(results) >= 1
        assert any("quantum" in r["content"] for r in results)


class TestFullSovereignFlow:
    """The main event: full end-to-end sovereign message flow.

    Alice generates identity -> encrypts message -> sends via file transport
    -> Bob receives -> decrypts -> stores in memory -> retrieves.
    """

    def test_alice_to_bob_encrypted_message(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Full flow: identity -> encrypt -> transport -> decrypt -> store."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.crypto import ChatCrypto
        from skchat.history import ChatHistory
        from skchat.models import ChatMessage, DeliveryStatus
        from skcomm.models import MessageEnvelope, MessagePayload
        from skcomm.transports.file import FileTransport

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        # --- Alice side: compose, encrypt, send ---
        msg = ChatMessage(
            sender="capauth:alice@skworld.io",
            recipient="capauth:bob@skworld.io",
            content="The sovereign stack works end-to-end!",
            thread_id="e2e-thread",
        )

        encrypted = alice_crypto.encrypt_message(msg, bob_pub)
        assert encrypted.encrypted is True

        outbox = tmp_path / "filedrop"
        outbox.mkdir()

        envelope = MessageEnvelope(
            sender="alice",
            recipient="bob",
            payload=MessagePayload(content=encrypted.model_dump_json()),
        )

        alice_transport = FileTransport(outbox_path=outbox, archive=False)
        send_result = alice_transport.send(envelope.to_bytes(), "bob")
        assert send_result.success is True

        # --- Bob side: receive, decrypt, store ---
        bob_transport = FileTransport(inbox_path=outbox, archive=False)
        received_bytes = bob_transport.receive()
        assert len(received_bytes) == 1

        received_env = MessageEnvelope.from_bytes(received_bytes[0])
        received_msg = ChatMessage.model_validate_json(received_env.payload.content)
        assert received_msg.encrypted is True

        decrypted = bob_crypto.decrypt_message(received_msg)
        assert decrypted.content == "The sovereign stack works end-to-end!"

        # --- Bob stores in SKMemory ---
        bob_memory = SQLiteBackend(base_path=str(tmp_path / "bob-memory"))
        bob_store = MemoryStore(primary=bob_memory)
        bob_history = ChatHistory(store=bob_store)

        stored_msg = decrypted.model_copy(
            update={"delivery_status": DeliveryStatus.DELIVERED}
        )
        mem_id = bob_history.store_message(stored_msg)
        assert mem_id is not None

        # --- Verify retrieval ---
        thread_msgs = bob_history.get_thread_messages("e2e-thread")
        assert len(thread_msgs) == 1
        assert thread_msgs[0]["sender"] == "capauth:alice@skworld.io"
        assert "sovereign stack" in thread_msgs[0]["content"]

    def test_bidirectional_conversation(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Alice and Bob exchange multiple messages in both directions."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.crypto import ChatCrypto
        from skchat.history import ChatHistory
        from skchat.models import ChatMessage

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        backend = SQLiteBackend(base_path=str(tmp_path / "convo-memory"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        exchanges = [
            ("capauth:alice@skworld.io", "capauth:bob@skworld.io",
             "Hey Bob, sovereignty check!", alice_crypto, bob_pub),
            ("capauth:bob@skworld.io", "capauth:alice@skworld.io",
             "All systems sovereign, Alice!", bob_crypto, alice_pub),
            ("capauth:alice@skworld.io", "capauth:bob@skworld.io",
             "Perfect. Ship it.", alice_crypto, bob_pub),
        ]

        for sender, recipient, content, crypto, peer_pub in exchanges:
            msg = ChatMessage(sender=sender, recipient=recipient, content=content)
            encrypted = crypto.encrypt_message(msg, peer_pub)

            if sender == "capauth:alice@skworld.io":
                decrypted = bob_crypto.decrypt_message(encrypted)
            else:
                decrypted = alice_crypto.decrypt_message(encrypted)

            assert decrypted.content == content
            history.store_message(decrypted)

        assert history.message_count() == 3

        conversation = history.get_conversation(
            "capauth:alice@skworld.io", "capauth:bob@skworld.io"
        )
        assert len(conversation) == 3

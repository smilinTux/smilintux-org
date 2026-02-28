"""End-to-end integration tests: SKChat → SKComm delivery round-trip.

Tests the full message flow through the SKComm high-level engine:
  1. SKComm: instantiate engine with Router + registered FileTransport
  2. SKChat ChatCrypto: compose and encrypt message with CapAuth keys
  3. SKComm send(): wraps encrypted payload in envelope, routes via FileTransport
  4. SKComm receive(): deserializes received bytes into MessageEnvelope objects
  5. SKChat: decrypt recovered payload — content matches original
  6. Thread IDs and urgency levels survive the round-trip
  7. Reply chain: in_reply_to propagates through transport correctly

No mocks. Real routing engine. Real PGP crypto. Real file I/O.
"""

from __future__ import annotations

from pathlib import Path

import pytest

PASSPHRASE = "sovereign-test-key-2026"


def _make_comms(tmp_path: Path):
    """Build two SKComm instances connected via crossed FileTransports.

    ACK is disabled (ack=False) so auto-ACK control envelopes do not
    interfere with assertions on data message counts.

    Returns:
        tuple: (alice_comm, bob_comm, alice_to_bob_dir, bob_to_alice_dir)
    """
    from skcomm.config import SKCommConfig
    from skcomm.core import SKComm
    from skcomm.router import Router
    from skcomm.transports.file import FileTransport

    alice_to_bob = tmp_path / "a2b"
    bob_to_alice = tmp_path / "b2a"
    alice_to_bob.mkdir()
    bob_to_alice.mkdir()

    # Alice writes to a2b, reads from b2a
    alice_transport = FileTransport(
        outbox_path=alice_to_bob,
        inbox_path=bob_to_alice,
        archive=False,
    )
    # Bob writes to b2a, reads from a2b
    bob_transport = FileTransport(
        outbox_path=bob_to_alice,
        inbox_path=alice_to_bob,
        archive=False,
    )

    # Disable ACK: these tests verify data delivery, not ACK behaviour.
    # Default ack=True causes auto-ACK envelopes to accumulate in inboxes
    # and would pollute message-count assertions.
    no_ack_config = SKCommConfig(ack=False)

    alice_router = Router()
    alice_router.register_transport(alice_transport)
    alice_comm = SKComm(config=no_ack_config, router=alice_router)
    alice_comm._identity = "alice"

    bob_router = Router()
    bob_router.register_transport(bob_transport)
    bob_comm = SKComm(config=no_ack_config, router=bob_router)
    bob_comm._identity = "bob"

    return alice_comm, bob_comm, alice_to_bob, bob_to_alice


class TestSKCommHighLevelAPI:
    """Verify SKComm high-level send/receive API wired to FileTransport."""

    def test_send_returns_delivery_report(self, tmp_path: Path) -> None:
        """SKComm.send() returns a successful DeliveryReport."""
        alice_comm, _, _, _ = _make_comms(tmp_path)

        report = alice_comm.send("bob", "Hello from the high-level API!")
        assert report.delivered is True
        assert report.successful_transport is not None

    def test_receive_returns_envelope_objects(self, tmp_path: Path) -> None:
        """SKComm.receive() returns deserialized MessageEnvelope instances."""
        from skcomm.models import MessageEnvelope

        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_comm.send("bob", "Sovereign envelope incoming.")
        envelopes = bob_comm.receive()

        assert len(envelopes) == 1
        assert isinstance(envelopes[0], MessageEnvelope)
        assert envelopes[0].payload.content == "Sovereign envelope incoming."

    def test_sender_and_recipient_preserved(self, tmp_path: Path) -> None:
        """Sender and recipient fields survive serialization round-trip."""
        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_comm.send("bob", "Identity check.")
        envelopes = bob_comm.receive()

        assert envelopes[0].sender == "alice"
        assert envelopes[0].recipient == "bob"

    def test_multiple_messages_queued(self, tmp_path: Path) -> None:
        """Multiple sends result in multiple received envelopes."""
        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        messages = ["First message", "Second message", "Third message"]
        for msg in messages:
            alice_comm.send("bob", msg)

        received = bob_comm.receive()
        assert len(received) == 3
        contents = {e.payload.content for e in received}
        assert contents == set(messages)

    def test_bidirectional_exchange(self, tmp_path: Path) -> None:
        """Both agents can send and receive in both directions."""
        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_comm.send("bob", "Alice to Bob.")
        bob_comm.send("alice", "Bob to Alice.")

        alice_received = alice_comm.receive()
        bob_received = bob_comm.receive()

        assert len(alice_received) == 1
        assert alice_received[0].payload.content == "Bob to Alice."
        assert len(bob_received) == 1
        assert bob_received[0].payload.content == "Alice to Bob."


class TestSKCommThreading:
    """Verify thread_id and reply chain propagate through SKComm."""

    def test_thread_id_survives_round_trip(self, tmp_path: Path) -> None:
        """thread_id set on send is present in received envelope."""
        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_comm.send(
            "bob",
            "Threading test message.",
            thread_id="sovereign-thread-42",
        )
        envelopes = bob_comm.receive()

        assert envelopes[0].metadata.thread_id == "sovereign-thread-42"

    def test_in_reply_to_propagates(self, tmp_path: Path) -> None:
        """in_reply_to chains messages into a reply thread."""
        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        # Alice sends first message
        alice_comm.send("bob", "Initial message.", thread_id="reply-test")
        first_envelope = bob_comm.receive()[0]
        first_id = first_envelope.envelope_id

        # Bob replies with in_reply_to set
        bob_comm.send(
            "alice",
            "Reply to initial message.",
            thread_id="reply-test",
            in_reply_to=first_id,
        )
        replies = alice_comm.receive()

        assert len(replies) == 1
        assert replies[0].metadata.in_reply_to == first_id
        assert replies[0].metadata.thread_id == "reply-test"


class TestSKChatSKCommRoundTrip:
    """Full round-trip: SKChat encrypt → SKComm transport → SKChat decrypt."""

    def test_encrypted_message_delivered_and_decrypted(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Alice encrypts via SKChat, delivers via SKComm, Bob decrypts correctly."""
        from skcomm.models import MessageEnvelope, MessagePayload

        from skchat.crypto import ChatCrypto
        from skchat.models import ChatMessage

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys

        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        # Alice: compose, encrypt, send
        msg = ChatMessage(
            sender="capauth:alice@skworld.io",
            recipient="capauth:bob@skworld.io",
            content="SKChat payload delivered via SKComm.",
            thread_id="skchat-skcomm-thread",
        )
        encrypted = alice_crypto.encrypt_message(msg, bob_pub)
        assert encrypted.encrypted is True

        alice_comm.send(
            "bob",
            encrypted.model_dump_json(),
            thread_id="skchat-skcomm-thread",
        )

        # Bob: receive, extract, decrypt
        envelopes = bob_comm.receive()
        assert len(envelopes) == 1

        received_msg = ChatMessage.model_validate_json(
            envelopes[0].payload.content
        )
        assert received_msg.encrypted is True

        decrypted = bob_crypto.decrypt_message(received_msg)
        assert decrypted.content == "SKChat payload delivered via SKComm."
        assert decrypted.thread_id == "skchat-skcomm-thread"

    def test_full_conversation_round_trip(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Multiple encrypted messages exchanged and verified in sequence."""
        from skchat.crypto import ChatCrypto
        from skchat.models import ChatMessage

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys

        alice_comm, bob_comm, _, _ = _make_comms(tmp_path)

        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        exchanges = [
            ("alice", "bob", alice_crypto, bob_pub, bob_crypto, "Ping!"),
            ("bob", "alice", bob_crypto, alice_pub, alice_crypto, "Pong!"),
            ("alice", "bob", alice_crypto, bob_pub, bob_crypto, "Sovereignty confirmed."),
        ]

        for sender, recipient, sender_crypto, recv_pub, recv_crypto, content in exchanges:
            msg = ChatMessage(
                sender=f"capauth:{sender}@skworld.io",
                recipient=f"capauth:{recipient}@skworld.io",
                content=content,
                thread_id="conversation-thread",
            )
            encrypted = sender_crypto.encrypt_message(msg, recv_pub)

            if sender == "alice":
                alice_comm.send(recipient, encrypted.model_dump_json())
                received = bob_comm.receive()
            else:
                bob_comm.send(recipient, encrypted.model_dump_json())
                received = alice_comm.receive()

            assert len(received) == 1
            recovered = ChatMessage.model_validate_json(received[0].payload.content)
            decrypted = recv_crypto.decrypt_message(recovered)
            assert decrypted.content == content

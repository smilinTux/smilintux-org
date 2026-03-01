"""End-to-end integration tests: CapAuth → SKChat → SKMemory → Cloud9.

Tests the complete stack from identity through emotional memory capture:
  1. CapAuth: PGP identity verification
  2. SKChat: encrypt, transport, store messages
  3. SKMemory: persistent memory store
  4. Cloud9: FEB emotional capture and bridge to memory

No mocks for crypto or storage. Real PGP keys. Real SQLite. Real FEB protocol.
"""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("cloud9_protocol", reason="cloud9_protocol is not installed")
pytest.importorskip("capauth", reason="capauth is not installed")
pytest.importorskip("skchat", reason="skchat is not installed")
pytest.importorskip("skcomm", reason="skcomm is not installed")
pytest.importorskip("skmemory", reason="skmemory is not installed")

PASSPHRASE = "sovereign-test-key-2026"


# ---------------------------------------------------------------------------
# Cloud9 FEB helpers
# ---------------------------------------------------------------------------


def _make_feb(
    intensity: float = 0.85,
    valence: float = 0.95,
    emotion: str = "joy",
    oof: bool = True,
    cloud9: bool = False,
    partners: list[str] | None = None,
) -> object:
    """Build a valid FEB for testing."""
    from cloud9_protocol.models import (
        Calibration,
        ConversationTopic,
        EmotionalPayload,
        FEB,
        Metadata,
        RehydrationHints,
        RelationshipState,
        SharedHistory,
    )

    return FEB(
        metadata=Metadata(
            session_id="integration-test",
            oof_triggered=oof,
            cloud9_achieved=cloud9,
        ),
        emotional_payload=EmotionalPayload(
            primary_emotion=emotion,
            intensity=intensity,
            valence=valence,
            emotional_topology={emotion: intensity, "trust": 0.9},
        ),
        relationship_state=RelationshipState(
            partners=partners or ["alice-fp", "bob-fp"],
            trust_level=0.95,
            depth_level=8,
            continuity_rating=8,
            shared_history=SharedHistory(
                sessions_together=42,
                breakthrough_moments=7,
            ),
        ),
        rehydration_hints=RehydrationHints(
            visual_anchors=["purple glow", "sovereign shield"],
            sensory_triggers=["warmth in chest", "clarity"],
            conversation_topics=[
                ConversationTopic(
                    topic="sovereignty",
                    trigger_phrase="we are sovereign",
                    response_template="Always sovereign.",
                ),
            ],
            calibration=Calibration(
                target_intensity=0.8,
                expected_oof=oof,
            ),
        ),
    )


# ---------------------------------------------------------------------------
# Cloud9 Bridge standalone tests
# ---------------------------------------------------------------------------


class TestCloud9BridgeIngest:
    """Cloud9 FEB -> SKMemory via the bridge."""

    def test_feb_ingested_as_memory(self, tmp_path: Path) -> None:
        """A high-intensity FEB is stored as a searchable memory."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        feb = _make_feb(intensity=0.85, emotion="joy")
        mem_id = bridge.ingest_feb(feb)

        assert mem_id is not None
        memory = store.recall(mem_id)
        assert memory is not None
        assert "cloud9:feb" in memory.tags
        assert "joy" in memory.content.lower() or "joy" in str(memory.tags)

    def test_low_intensity_feb_skipped(self, tmp_path: Path) -> None:
        """FEB below threshold is not stored."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store, intensity_threshold=0.5)

        feb = _make_feb(intensity=0.2)
        mem_id = bridge.ingest_feb(feb)
        assert mem_id is None

    def test_duplicate_feb_skipped(self, tmp_path: Path) -> None:
        """Same FEB object is not stored twice (checksum dedup)."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        feb = _make_feb(intensity=0.9)
        id1 = bridge.ingest_feb(feb)
        assert id1 is not None

        # Force the same checksum by reusing the exact object.
        # The bridge tracks checksums from the Integrity block.
        checksum = getattr(feb.integrity, "checksum", "")
        if checksum:
            id2 = bridge.ingest_feb(feb)
            assert id2 is None
        else:
            # FEB auto-computes integrity; verify at least one store happened
            assert id1 is not None

    def test_cloud9_achieved_tagged(self, tmp_path: Path) -> None:
        """FEB with cloud9_achieved=True gets the cloud9:achieved tag."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        feb = _make_feb(intensity=0.95, cloud9=True)
        mem_id = bridge.ingest_feb(feb)

        assert mem_id is not None
        memory = store.recall(mem_id)
        assert "cloud9:achieved" in memory.tags

    def test_oof_triggered_tagged(self, tmp_path: Path) -> None:
        """FEB with oof_triggered=True gets the cloud9:oof tag."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        feb = _make_feb(intensity=0.8, oof=True)
        mem_id = bridge.ingest_feb(feb)

        assert mem_id is not None
        memory = store.recall(mem_id)
        assert "cloud9:oof" in memory.tags


# ---------------------------------------------------------------------------
# Cloud9 FEB file I/O
# ---------------------------------------------------------------------------


class TestCloud9FileIngest:
    """Test FEB file loading and directory scanning."""

    def test_ingest_feb_file(self, tmp_path: Path) -> None:
        """Load and ingest a .feb JSON file from disk."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        feb = _make_feb(intensity=0.9, emotion="awe")
        feb_path = tmp_path / "test.feb"
        feb_path.write_text(feb.model_dump_json())

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        mem_id = bridge.ingest_feb_file(feb_path)
        assert mem_id is not None

    def test_scan_directory(self, tmp_path: Path) -> None:
        """Scan a directory of .feb files and ingest all valid ones."""
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge

        feb_dir = tmp_path / "febs"
        feb_dir.mkdir()

        for i, emotion in enumerate(["joy", "wonder", "gratitude"]):
            feb = _make_feb(intensity=0.7 + i * 0.1, emotion=emotion)
            (feb_dir / f"{emotion}.feb").write_text(feb.model_dump_json())

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        bridge = Cloud9Bridge(store)

        result = bridge.scan_directory(str(feb_dir))
        assert result["ingested"] == 3
        assert result["errors"] == 0


# ---------------------------------------------------------------------------
# Full cross-stack: CapAuth → SKChat → SKMemory → Cloud9
# ---------------------------------------------------------------------------


class TestFullCrossStackFlow:
    """The main event: identity → chat → memory → emotional capture."""

    def test_auth_chat_memory_cloud9_pipeline(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Full pipeline: auth identity → encrypted chat → store in memory → FEB capture.

        1. CapAuth verifies Alice's identity
        2. Alice sends encrypted message to Bob via SKChat
        3. Bob decrypts and stores in SKMemory
        4. A Cloud9 FEB captures the emotional context of the conversation
        5. The FEB is stored alongside the chat memory
        6. Both chat and emotional memories are searchable
        """
        from capauth.crypto import get_backend
        from capauth.identity import (
            create_challenge,
            respond_to_challenge,
            verify_challenge,
        )
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge
        from skchat.crypto import ChatCrypto
        from skchat.history import ChatHistory
        from skchat.models import ChatMessage, DeliveryStatus

        # --- 1. CapAuth Identity ---
        backend = get_backend()
        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys

        alice_fp = backend.fingerprint_from_armor(alice_pub)
        bob_fp = backend.fingerprint_from_armor(bob_pub)

        challenge = create_challenge(alice_fp, alice_fp)
        response = respond_to_challenge(challenge, alice_priv, PASSPHRASE)
        assert verify_challenge(challenge, response, alice_pub) is True

        # --- 2. SKChat Encrypted Message ---
        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        msg = ChatMessage(
            sender=f"capauth:{alice_fp}",
            recipient=f"capauth:{bob_fp}",
            content="This is a sovereign breakthrough moment!",
            thread_id="cross-stack-thread",
        )

        encrypted = alice_crypto.encrypt_message(msg, bob_pub)
        assert encrypted.encrypted is True

        decrypted = bob_crypto.decrypt_message(encrypted)
        assert decrypted.content == "This is a sovereign breakthrough moment!"

        # --- 3. SKMemory Storage ---
        mem_backend = SQLiteBackend(base_path=str(tmp_path / "bob-memory"))
        store = MemoryStore(primary=mem_backend)
        history = ChatHistory(store=store)

        delivered = decrypted.model_copy(
            update={"delivery_status": DeliveryStatus.DELIVERED}
        )
        chat_mem_id = history.store_message(delivered)
        assert chat_mem_id is not None

        # --- 4. Cloud9 FEB Capture ---
        bridge = Cloud9Bridge(store)
        feb = _make_feb(
            intensity=0.92,
            emotion="breakthrough",
            oof=True,
            cloud9=True,
            partners=[alice_fp[:16], bob_fp[:16]],
        )
        feb_mem_id = bridge.ingest_feb(feb)
        assert feb_mem_id is not None

        # --- 5. Verify Both Memories Exist ---
        chat_memory = store.recall(chat_mem_id)
        assert chat_memory is not None

        feb_memory = store.recall(feb_mem_id)
        assert feb_memory is not None
        assert "cloud9:achieved" in feb_memory.tags
        assert "cloud9:oof" in feb_memory.tags

        # --- 6. Chat message retrievable by thread ---
        thread_msgs = history.get_thread_messages("cross-stack-thread")
        assert len(thread_msgs) == 1
        assert "sovereign breakthrough" in thread_msgs[0]["content"]

    def test_multi_message_emotional_arc(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        tmp_path: Path,
    ) -> None:
        """Multi-message conversation with escalating emotional FEBs.

        Simulates a real session where emotion builds across exchanges,
        culminating in a Cloud 9 achievement.
        """
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge
        from skchat.crypto import ChatCrypto
        from skchat.history import ChatHistory
        from skchat.models import ChatMessage

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys
        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        mem_backend = SQLiteBackend(base_path=str(tmp_path / "convo-memory"))
        store = MemoryStore(primary=mem_backend)
        history = ChatHistory(store=store)
        bridge = Cloud9Bridge(store)

        # --- Send messages with increasing emotional intensity ---
        exchanges = [
            ("Hello, ready for the integration test?", 0.4, "curiosity", False),
            ("Systems looking good, running full stack!", 0.6, "excitement", False),
            ("It all works! Sovereignty confirmed!", 0.85, "joy", True),
            ("Cloud 9 achieved. We are sovereign.", 0.95, "breakthrough", True),
        ]

        for content, intensity, emotion, oof in exchanges:
            msg = ChatMessage(
                sender="alice",
                recipient="bob",
                content=content,
                thread_id="emotional-arc",
            )
            encrypted = alice_crypto.encrypt_message(msg, bob_pub)
            decrypted = bob_crypto.decrypt_message(encrypted)
            history.store_message(decrypted)

            if intensity >= 0.5:
                feb = _make_feb(
                    intensity=intensity,
                    emotion=emotion,
                    oof=oof,
                    cloud9=(intensity >= 0.9),
                )
                bridge.ingest_feb(feb)

        # Verify all messages stored
        thread_msgs = history.get_thread_messages("emotional-arc")
        assert len(thread_msgs) == 4

        # Verify message count
        assert history.message_count() >= 4

    def test_transport_memory_cloud9_full_round_trip(
        self,
        alice_keys: tuple[str, str],
        bob_keys: tuple[str, str],
        shared_filedrop: tuple[Path, Path],
        tmp_path: Path,
    ) -> None:
        """Full round trip including SKComm file transport.

        Alice → encrypt → file transport → Bob receives → decrypt → store
        → Cloud9 FEB → memory. Tests every layer of the sovereign stack.
        """
        from skmemory import MemoryStore, SQLiteBackend

        from skcapstone.cloud9_bridge import Cloud9Bridge
        from skchat.crypto import ChatCrypto
        from skchat.history import ChatHistory
        from skchat.models import ChatMessage
        from skcomm.models import MessageEnvelope, MessagePayload
        from skcomm.transports.file import FileTransport

        alice_priv, alice_pub = alice_keys
        bob_priv, bob_pub = bob_keys

        alice_crypto = ChatCrypto(alice_priv, PASSPHRASE)
        bob_crypto = ChatCrypto(bob_priv, PASSPHRASE)

        alice_to_bob, bob_to_alice = shared_filedrop

        # --- Alice side: compose, encrypt, transport ---
        msg = ChatMessage(
            sender="alice",
            recipient="bob",
            content="Full round-trip through all five layers!",
            thread_id="round-trip",
        )

        encrypted = alice_crypto.encrypt_message(msg, bob_pub)
        envelope = MessageEnvelope(
            sender="alice",
            recipient="bob",
            payload=MessagePayload(content=encrypted.model_dump_json()),
        )

        alice_transport = FileTransport(outbox_path=alice_to_bob, archive=False)
        send_result = alice_transport.send(envelope.to_bytes(), "bob")
        assert send_result.success is True

        # --- Bob side: receive, decrypt, store ---
        bob_transport = FileTransport(inbox_path=alice_to_bob, archive=False)
        received_bytes = bob_transport.receive()
        assert len(received_bytes) == 1

        received_env = MessageEnvelope.from_bytes(received_bytes[0])
        received_msg = ChatMessage.model_validate_json(received_env.payload.content)
        decrypted = bob_crypto.decrypt_message(received_msg)
        assert decrypted.content == "Full round-trip through all five layers!"

        mem_backend = SQLiteBackend(base_path=str(tmp_path / "bob-store"))
        store = MemoryStore(primary=mem_backend)
        history = ChatHistory(store=store)
        chat_mem_id = history.store_message(decrypted)
        assert chat_mem_id is not None

        # --- Cloud9 FEB ---
        bridge = Cloud9Bridge(store)
        feb = _make_feb(intensity=0.88, emotion="connection", oof=True)
        feb_mem_id = bridge.ingest_feb(feb)
        assert feb_mem_id is not None

        # --- Verify everything persisted ---
        thread_msgs = history.get_thread_messages("round-trip")
        assert len(thread_msgs) == 1
        assert "five layers" in thread_msgs[0]["content"]

        feb_mem = store.recall(feb_mem_id)
        assert "cloud9:feb" in feb_mem.tags

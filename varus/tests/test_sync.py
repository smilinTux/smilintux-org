"""Tests for varus.sync — P2P chain sharing via SKComm FileTransport.

All tests use a minimal stub that mimics the FileTransport interface so that
skcomm is not required to run the test suite.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from varus.block import Block
from varus.chain import GENESIS_HASH, VarusChain
from varus.sync import ChainSync, _validate_remote_chain
from varus.chain import ChainError


# ---------------------------------------------------------------------------
# FileTransport stub
# ---------------------------------------------------------------------------

@dataclass
class _SendResult:
    success: bool
    transport_name: str = "file"
    envelope_id: str = "test-envelope"
    latency_ms: float = 0.0
    error: str | None = None


class _FileTransportStub:
    """Minimal stand-in for skcomm.transports.file.FileTransport."""

    def __init__(self, *, outbox_path=None, inbox_path=None):
        self.sent: list[tuple[bytes, str]] = []
        self._inbox_payloads: list[bytes] = []

    def send(self, envelope_bytes: bytes, recipient: str) -> _SendResult:
        self.sent.append((envelope_bytes, recipient))
        return _SendResult(success=True)

    def receive(self) -> list[bytes]:
        payloads, self._inbox_payloads = self._inbox_payloads, []
        return payloads

    def inject(self, payload: bytes) -> None:
        """Feed bytes into the stub inbox for the next receive() call."""
        self._inbox_payloads.append(payload)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chain(tmp_path: Path, blocks: int = 0) -> VarusChain:
    chain = VarusChain(tmp_path / "chain.json")
    chain.load()
    for i in range(blocks):
        chain.add_block({"n": i})
    return chain


def _make_sync(chain: VarusChain, stub: _FileTransportStub) -> ChainSync:
    sync = ChainSync(chain, agent_name="test-node")
    sync._make_transport = lambda: stub  # type: ignore[method-assign]
    return sync


def _chain_snapshot(chain: VarusChain, sender: str = "remote") -> bytes:
    """Build a valid varus_chain_snapshot envelope from a chain."""
    envelope = {
        "envelope_id": f"varus-test-{int(time.time())}",
        "type": "varus_chain_snapshot",
        "sender": sender,
        "timestamp": time.time(),
        "chain": [b.to_dict() for b in chain.all_blocks()],
    }
    return json.dumps(envelope).encode()


# ---------------------------------------------------------------------------
# _validate_remote_chain
# ---------------------------------------------------------------------------

class TestValidateRemoteChain:
    def test_rejects_empty(self):
        with pytest.raises(ChainError, match="empty"):
            _validate_remote_chain([])

    def test_rejects_bad_genesis_prev_hash(self, tmp_path):
        chain = _make_chain(tmp_path)
        raw = [b.to_dict() for b in chain.all_blocks()]
        raw[0]["previous_hash"] = "a" * 64
        # Must recompute hash too to make it "self-consistent" but still wrong genesis
        raw[0]["hash"] = "a" * 64  # corrupt hash so is_valid() fails
        with pytest.raises(ChainError):
            _validate_remote_chain(raw)

    def test_rejects_tampered_block_hash(self, tmp_path):
        chain = _make_chain(tmp_path, blocks=2)
        raw = [b.to_dict() for b in chain.all_blocks()]
        raw[1]["hash"] = "f" * 64  # tamper
        with pytest.raises(ChainError, match="hash mismatch"):
            _validate_remote_chain(raw)

    def test_rejects_broken_link(self, tmp_path):
        chain = _make_chain(tmp_path, blocks=2)
        raw = [b.to_dict() for b in chain.all_blocks()]
        # Set block 1's previous_hash to garbage (and recompute its hash so
        # is_valid passes, but the link from 0→1 is broken)
        b1 = Block.from_dict(raw[1])
        raw[1]["previous_hash"] = "b" * 64
        raw[1]["hash"] = Block(
            index=raw[1]["index"],
            timestamp=raw[1]["timestamp"],
            data=raw[1]["data"],
            previous_hash="b" * 64,
        ).hash
        with pytest.raises(ChainError, match="link broken"):
            _validate_remote_chain(raw)

    def test_rejects_wrong_index(self, tmp_path):
        chain = _make_chain(tmp_path, blocks=1)
        raw = [b.to_dict() for b in chain.all_blocks()]
        raw[1]["index"] = 99
        raw[1]["hash"] = Block(
            index=99,
            timestamp=raw[1]["timestamp"],
            data=raw[1]["data"],
            previous_hash=raw[1]["previous_hash"],
        ).hash
        with pytest.raises(ChainError, match="wrong index"):
            _validate_remote_chain(raw)

    def test_valid_chain_passes(self, tmp_path):
        chain = _make_chain(tmp_path, blocks=3)
        raw = [b.to_dict() for b in chain.all_blocks()]
        blocks = _validate_remote_chain(raw)
        assert len(blocks) == 4  # genesis + 3


# ---------------------------------------------------------------------------
# ChainSync.export_chain
# ---------------------------------------------------------------------------

class TestExportChain:
    def test_writes_to_outbox(self, tmp_path):
        chain = _make_chain(tmp_path, blocks=2)
        stub = _FileTransportStub()
        sync = _make_sync(chain, stub)

        envelope_id = sync.export_chain(recipient="peer-a")

        assert len(stub.sent) == 1
        raw_bytes, recipient = stub.sent[0]
        assert recipient == "peer-a"
        envelope = json.loads(raw_bytes)
        assert envelope["type"] == "varus_chain_snapshot"
        assert envelope["sender"] == "test-node"
        assert envelope["envelope_id"] == envelope_id
        assert len(envelope["chain"]) == 3  # genesis + 2

    def test_default_recipient(self, tmp_path):
        chain = _make_chain(tmp_path)
        stub = _FileTransportStub()
        sync = _make_sync(chain, stub)
        sync.export_chain()
        _, recipient = stub.sent[0]
        assert recipient == "peer"

    def test_raises_on_send_failure(self, tmp_path):
        chain = _make_chain(tmp_path)
        stub = _FileTransportStub()
        stub.send = lambda *_: _SendResult(success=False, error="disk full")  # type: ignore[method-assign]
        sync = _make_sync(chain, stub)
        with pytest.raises(RuntimeError, match="disk full"):
            sync.export_chain()

    def test_missing_skcomm_raises_runtime_error(self, tmp_path):
        chain = _make_chain(tmp_path)
        sync = ChainSync(chain)
        import builtins
        real_import = builtins.__import__

        def block_skcomm(name, *args, **kwargs):
            if name.startswith("skcomm"):
                raise ImportError("No module named 'skcomm'")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=block_skcomm):
            with pytest.raises(RuntimeError, match="skcomm is required"):
                sync.export_chain()


# ---------------------------------------------------------------------------
# ChainSync.import_chain
# ---------------------------------------------------------------------------

class TestImportChain:
    def test_merges_new_blocks(self, tmp_path):
        # Remote chain has 3 extra blocks beyond genesis
        remote_chain = _make_chain(tmp_path / "remote", blocks=3)
        local_chain = _make_chain(tmp_path / "local")  # only genesis

        stub = _FileTransportStub()
        stub.inject(_chain_snapshot(remote_chain, sender="remote-node"))
        sync = _make_sync(local_chain, stub)

        results = sync.import_chain()

        assert len(results) == 1
        r = results[0]
        assert r["ok"] is True
        assert r["blocks_added"] == 3
        assert r["chain_height"] == 4
        assert r["sender"] == "remote-node"
        assert local_chain.height == 4
        assert local_chain.is_valid()

    def test_ignores_shorter_chain(self, tmp_path):
        local_chain = _make_chain(tmp_path / "local", blocks=5)
        remote_chain = _make_chain(tmp_path / "remote", blocks=2)

        stub = _FileTransportStub()
        stub.inject(_chain_snapshot(remote_chain))
        sync = _make_sync(local_chain, stub)

        results = sync.import_chain()

        assert results[0]["ok"] is True
        assert results[0]["blocks_added"] == 0
        assert local_chain.height == 6  # unchanged

    def test_skips_non_varus_envelope(self, tmp_path):
        chain = _make_chain(tmp_path)
        stub = _FileTransportStub()
        stub.inject(json.dumps({"envelope_id": "x", "type": "skchat_message"}).encode())
        sync = _make_sync(chain, stub)

        results = sync.import_chain()

        assert results[0]["ok"] is False
        assert results[0]["skipped"] is True

    def test_skips_non_json_bytes(self, tmp_path):
        chain = _make_chain(tmp_path)
        stub = _FileTransportStub()
        stub.inject(b"\xff\xfe garbage")
        sync = _make_sync(chain, stub)

        results = sync.import_chain()

        assert results[0]["ok"] is False
        assert "JSON decode error" in results[0]["error"]

    def test_rejects_tampered_remote_chain(self, tmp_path):
        remote_chain = _make_chain(tmp_path / "remote", blocks=2)
        local_chain = _make_chain(tmp_path / "local")

        raw = [b.to_dict() for b in remote_chain.all_blocks()]
        raw[1]["hash"] = "f" * 64  # tamper

        envelope = {
            "envelope_id": "varus-tampered",
            "type": "varus_chain_snapshot",
            "sender": "evil-node",
            "timestamp": time.time(),
            "chain": raw,
        }
        stub = _FileTransportStub()
        stub.inject(json.dumps(envelope).encode())
        sync = _make_sync(local_chain, stub)

        results = sync.import_chain()

        assert results[0]["ok"] is False
        assert "hash mismatch" in results[0]["error"]
        assert local_chain.height == 1  # unchanged

    def test_rejects_forked_chain(self, tmp_path):
        # Both start from the same genesis but diverge at block 1
        local_chain = _make_chain(tmp_path / "local", blocks=2)
        fork_chain = _make_chain(tmp_path / "fork", blocks=3)  # different data -> different hashes

        stub = _FileTransportStub()
        stub.inject(_chain_snapshot(fork_chain))
        sync = _make_sync(local_chain, stub)

        results = sync.import_chain()

        # Fork detected — nothing added (genesis matches but block 1 diverges)
        assert results[0]["ok"] is True
        assert results[0]["blocks_added"] == 0

    def test_empty_inbox_returns_empty_list(self, tmp_path):
        chain = _make_chain(tmp_path)
        stub = _FileTransportStub()
        sync = _make_sync(chain, stub)

        results = sync.import_chain()
        assert results == []

    def test_multiple_envelopes_processed(self, tmp_path):
        # Two sequential snapshots of the same growing remote chain
        remote = _make_chain(tmp_path / "remote", blocks=1)
        local = _make_chain(tmp_path / "local")

        stub = _FileTransportStub()
        snap1 = _chain_snapshot(remote, sender="remote")

        remote.add_block({"step": 2})
        snap2 = _chain_snapshot(remote, sender="remote")

        stub.inject(snap1)
        stub.inject(snap2)
        sync = _make_sync(local, stub)

        results = sync.import_chain()

        assert len(results) == 2
        # First snapshot adds 1 block, second adds 1 more
        total_added = sum(r["blocks_added"] for r in results if r["ok"])
        assert total_added == 2
        assert local.height == 3

    def test_persisted_after_merge(self, tmp_path):
        remote = _make_chain(tmp_path / "remote", blocks=2)
        chain_path = tmp_path / "local" / "chain.json"
        local = VarusChain(chain_path)
        local.load()

        stub = _FileTransportStub()
        stub.inject(_chain_snapshot(remote))
        sync = _make_sync(local, stub)
        sync.import_chain()

        # Reload from disk and verify
        reloaded = VarusChain(chain_path)
        reloaded.load()
        assert reloaded.height == 3
        assert reloaded.is_valid()

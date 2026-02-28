"""Tests for varus.node."""

import json
import time

import pytest

from varus.node import VarusNode, BlockInbox


@pytest.fixture
def node(tmp_path):
    n = VarusNode(
        chain_path=tmp_path / "chain.json",
        inbox_dir=tmp_path / "inbox",
        tick=60,
    )
    n.chain.load()
    return n


class TestBlockInbox:
    def test_empty_inbox_has_no_pending(self, tmp_path):
        inbox = BlockInbox(tmp_path / "inbox")
        assert inbox.pending() == []

    def test_written_json_appears_as_pending(self, tmp_path):
        inbox = BlockInbox(tmp_path / "inbox")
        (inbox.inbox_dir / "001.json").write_text('{"key": "val"}')
        assert len(inbox.pending()) == 1

    def test_consume_removes_file_and_returns_data(self, tmp_path):
        inbox = BlockInbox(tmp_path / "inbox")
        path = inbox.inbox_dir / "item.json"
        path.write_text('{"k": 1}')
        data = inbox.consume(path)
        assert data == {"k": 1}
        assert not path.exists()


class TestVarusNode:
    def test_submit_block_increases_height(self, node):
        node.submit_block({"event": "test"})
        assert node.chain.height == 2

    def test_chain_remains_valid_after_submit(self, node):
        node.submit_block({"x": 1})
        node.submit_block({"x": 2})
        assert node.chain.is_valid()

    def test_status_contains_expected_keys(self, node):
        s = node.status()
        assert "running" in s
        assert "chain" in s
        assert "inbox_pending" in s

    def test_status_running_false_before_start(self, node):
        assert node.status()["running"] is False

    def test_process_inbox_picks_up_files(self, node):
        item = node.inbox.inbox_dir / "block.json"
        item.write_text('{"source": "inbox"}')
        node._process_inbox()
        assert node.chain.height == 2

    def test_process_inbox_removes_file(self, node):
        item = node.inbox.inbox_dir / "block.json"
        item.write_text('{"source": "inbox"}')
        node._process_inbox()
        assert not item.exists()

"""Tests for varus.block."""

import time

import pytest

from varus.block import Block


def make_block(**kwargs) -> Block:
    defaults = dict(
        index=1,
        timestamp=1000.0,
        data={"msg": "hello"},
        previous_hash="abc" * 21 + "a",
    )
    defaults.update(kwargs)
    return Block(**defaults)


class TestBlockCreation:
    def test_hash_is_computed_on_init(self):
        block = make_block()
        assert block.hash != ""
        assert len(block.hash) == 64

    def test_same_data_produces_same_hash(self):
        b1 = make_block(timestamp=1234.0)
        b2 = make_block(timestamp=1234.0)
        assert b1.hash == b2.hash

    def test_different_data_produces_different_hash(self):
        b1 = make_block(data={"x": 1})
        b2 = make_block(data={"x": 2})
        assert b1.hash != b2.hash

    def test_nonce_affects_hash(self):
        b1 = make_block(nonce=0)
        b2 = make_block(nonce=1)
        assert b1.hash != b2.hash


class TestBlockValidity:
    def test_fresh_block_is_valid(self):
        block = make_block()
        assert block.is_valid()

    def test_tampered_data_invalidates_hash(self):
        block = make_block()
        block.data["injected"] = "evil"
        assert not block.is_valid()

    def test_tampered_hash_field_detected(self):
        block = make_block()
        block.hash = "deadbeef" * 8
        assert not block.is_valid()


class TestBlockSerialization:
    def test_round_trip(self):
        original = make_block(index=3, timestamp=9999.5, nonce=7)
        restored = Block.from_dict(original.to_dict())
        assert restored.index == original.index
        assert restored.timestamp == original.timestamp
        assert restored.data == original.data
        assert restored.previous_hash == original.previous_hash
        assert restored.nonce == original.nonce
        assert restored.hash == original.hash

    def test_to_dict_contains_required_keys(self):
        block = make_block()
        d = block.to_dict()
        for key in ("index", "timestamp", "data", "previous_hash", "nonce", "hash"):
            assert key in d

    def test_from_dict_preserves_hash(self):
        block = make_block()
        restored = Block.from_dict(block.to_dict())
        assert restored.hash == block.hash
        assert restored.is_valid()

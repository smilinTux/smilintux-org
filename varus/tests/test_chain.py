"""Tests for varus.chain."""

import json
import time

import pytest

from varus.chain import VarusChain, ChainError, GENESIS_HASH


@pytest.fixture
def chain(tmp_path):
    c = VarusChain(tmp_path / "chain.json")
    c.load()
    return c


class TestGenesis:
    def test_genesis_created_on_first_load(self, chain):
        assert chain.height == 1

    def test_genesis_has_correct_previous_hash(self, chain):
        assert chain.genesis.previous_hash == GENESIS_HASH

    def test_genesis_is_valid(self, chain):
        assert chain.genesis.is_valid()

    def test_genesis_data_is_sovereign(self, chain):
        assert chain.genesis.data.get("sovereign") is True


class TestAddBlock:
    def test_add_block_increases_height(self, chain):
        chain.add_block({"action": "test"})
        assert chain.height == 2

    def test_added_block_links_to_previous(self, chain):
        b = chain.add_block({"x": 1})
        assert b.previous_hash == chain.genesis.hash

    def test_chain_of_three_is_valid(self, chain):
        chain.add_block({"step": 1})
        chain.add_block({"step": 2})
        assert chain.is_valid()

    def test_block_index_matches_position(self, chain):
        b = chain.add_block({"y": 42})
        assert b.index == 1


class TestPersistence:
    def test_chain_persists_across_load(self, tmp_path):
        path = tmp_path / "chain.json"
        c1 = VarusChain(path)
        c1.load()
        c1.add_block({"session": "first"})
        tip_hash = c1.tip.hash

        c2 = VarusChain(path)
        c2.load()
        assert c2.height == 2
        assert c2.tip.hash == tip_hash

    def test_chain_file_is_valid_json(self, tmp_path):
        path = tmp_path / "chain.json"
        c = VarusChain(path)
        c.load()
        c.add_block({"k": "v"})
        raw = json.loads(path.read_text())
        assert isinstance(raw, list)
        assert len(raw) == 2


class TestValidation:
    def test_fresh_chain_is_valid(self, chain):
        assert chain.is_valid()

    def test_tampered_block_data_detected(self, chain):
        chain.add_block({"legit": True})
        chain._blocks[1].data["injected"] = "evil"
        # recompute stored hash to simulate a slightly cleverer tampering
        # but leave the stored hash stale so is_valid() catches it
        assert not chain.is_valid()

    def test_broken_hash_link_detected(self, chain):
        chain.add_block({"a": 1})
        chain.add_block({"b": 2})
        # Break the previous_hash link on block 2
        chain._blocks[2].previous_hash = "0" * 64
        assert not chain.is_valid()

    def test_validate_raises_chain_error_on_bad_chain(self, chain):
        chain.add_block({"x": 1})
        chain._blocks[1].data["tampered"] = True
        with pytest.raises(ChainError):
            chain.validate()

    def test_empty_chain_raises_on_validate(self):
        c = VarusChain.__new__(VarusChain)
        c._blocks = []
        with pytest.raises(ChainError):
            c.validate()


class TestQueryMethods:
    def test_get_block_by_index(self, chain):
        chain.add_block({"n": 1})
        block = chain.get_block(1)
        assert block.index == 1

    def test_get_block_out_of_range(self, chain):
        with pytest.raises(IndexError):
            chain.get_block(999)

    def test_get_by_hash(self, chain):
        b = chain.add_block({"find": "me"})
        found = chain.get_by_hash(b.hash)
        assert found is not None
        assert found.index == b.index

    def test_get_by_hash_missing_returns_none(self, chain):
        assert chain.get_by_hash("notahash") is None

    def test_tip_is_last_block(self, chain):
        b = chain.add_block({"last": True})
        assert chain.tip.hash == b.hash

    def test_summary_keys(self, chain):
        s = chain.summary()
        for key in ("height", "genesis_hash", "tip_hash", "tip_index", "valid"):
            assert key in s

"""Tests for varus.cli."""

import json

import pytest

from varus.cli import main


@pytest.fixture
def chain_path(tmp_path):
    return str(tmp_path / "chain.json")


def run(args: list[str], chain_path: str) -> int:
    return main(["--chain", chain_path] + args)


class TestInit:
    def test_init_creates_chain(self, chain_path):
        rc = run(["init"], chain_path)
        assert rc == 0

    def test_init_twice_fails_without_force(self, chain_path):
        run(["init"], chain_path)
        rc = run(["init"], chain_path)
        assert rc != 0

    def test_init_twice_with_force_succeeds(self, chain_path):
        run(["init"], chain_path)
        rc = run(["init", "--force"], chain_path)
        assert rc == 0


class TestAdd:
    def test_add_block_returns_zero(self, chain_path):
        run(["init"], chain_path)
        rc = run(["add", '{"hello": "world"}'], chain_path)
        assert rc == 0

    def test_add_invalid_json_returns_nonzero(self, chain_path):
        run(["init"], chain_path)
        rc = run(["add", "not json"], chain_path)
        assert rc != 0

    def test_add_multiple_blocks(self, chain_path):
        run(["init"], chain_path)
        run(["add", '{"n": 1}'], chain_path)
        run(["add", '{"n": 2}'], chain_path)
        rc = run(["validate"], chain_path)
        assert rc == 0


class TestGet:
    def test_get_genesis(self, chain_path, capsys):
        run(["init"], chain_path)
        capsys.readouterr()  # flush init output
        rc = run(["get", "0"], chain_path)
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["index"] == 0

    def test_get_out_of_range(self, chain_path):
        run(["init"], chain_path)
        rc = run(["get", "999"], chain_path)
        assert rc != 0


class TestTip:
    def test_tip_returns_genesis_initially(self, chain_path, capsys):
        run(["init"], chain_path)
        capsys.readouterr()  # flush init output
        run(["tip"], chain_path)
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["index"] == 0

    def test_tip_updates_after_add(self, chain_path, capsys):
        run(["init"], chain_path)
        run(["add", '{"v": 42}'], chain_path)
        capsys.readouterr()  # flush init + add output
        run(["tip"], chain_path)
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["index"] == 1


class TestStatus:
    def test_status_output_is_json(self, chain_path, capsys):
        run(["init"], chain_path)
        capsys.readouterr()  # flush init output
        run(["status"], chain_path)
        out = capsys.readouterr().out
        data = json.loads(out)
        assert "height" in data
        assert data["valid"] is True


class TestValidate:
    def test_valid_chain_exits_zero(self, chain_path):
        run(["init"], chain_path)
        rc = run(["validate"], chain_path)
        assert rc == 0


class TestList:
    def test_list_shows_genesis(self, chain_path, capsys):
        run(["init"], chain_path)
        run(["list"], chain_path)
        out = capsys.readouterr().out
        assert "0" in out

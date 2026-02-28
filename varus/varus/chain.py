"""Chain management and validation for the Varus sovereign chain."""

import json
import time
from pathlib import Path
from typing import Any

from .block import Block

GENESIS_HASH = "0" * 64
CHAIN_FILE = "varus_chain.json"


class ChainError(Exception):
    """Raised when chain integrity is violated."""


class VarusChain:
    """Append-only sovereign blockchain with local JSON persistence."""

    def __init__(self, chain_path: str | Path | None = None) -> None:
        self.chain_path = Path(chain_path) if chain_path else Path(CHAIN_FILE)
        self._blocks: list[Block] = []

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load chain from disk.  Creates genesis block if no file exists."""
        if self.chain_path.exists():
            raw = json.loads(self.chain_path.read_text())
            self._blocks = [Block.from_dict(b) for b in raw]
            self.validate()
        else:
            self._blocks = [self._make_genesis()]
            self.save()

    def save(self) -> None:
        """Persist chain to disk."""
        self.chain_path.parent.mkdir(parents=True, exist_ok=True)
        self.chain_path.write_text(
            json.dumps([b.to_dict() for b in self._blocks], indent=2)
        )

    # ------------------------------------------------------------------
    # Genesis
    # ------------------------------------------------------------------

    @staticmethod
    def _make_genesis() -> Block:
        """Create the immutable genesis block."""
        return Block(
            index=0,
            timestamp=0.0,
            data={"message": "Varus sovereign chain genesis", "sovereign": True},
            previous_hash=GENESIS_HASH,
        )

    @property
    def genesis(self) -> Block:
        if not self._blocks:
            raise ChainError("Chain is empty — call load() first.")
        return self._blocks[0]

    # ------------------------------------------------------------------
    # Block operations
    # ------------------------------------------------------------------

    @property
    def tip(self) -> Block:
        """Return the most recent block."""
        if not self._blocks:
            raise ChainError("Chain is empty — call load() first.")
        return self._blocks[-1]

    @property
    def height(self) -> int:
        return len(self._blocks)

    def add_block(self, data: dict[str, Any]) -> Block:
        """Append a new block to the chain and persist."""
        block = Block(
            index=self.height,
            timestamp=time.time(),
            data=data,
            previous_hash=self.tip.hash,
        )
        self._blocks.append(block)
        self.save()
        return block

    def get_block(self, index: int) -> Block:
        """Return block at given index."""
        if index < 0 or index >= len(self._blocks):
            raise IndexError(f"No block at index {index}")
        return self._blocks[index]

    def get_by_hash(self, block_hash: str) -> Block | None:
        """Return block with matching hash, or None."""
        for block in self._blocks:
            if block.hash == block_hash:
                return block
        return None

    def all_blocks(self) -> list[Block]:
        return list(self._blocks)

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self) -> None:
        """Raise ChainError if the chain is tampered or malformed."""
        if not self._blocks:
            raise ChainError("Chain has no blocks.")

        genesis = self._blocks[0]
        if genesis.previous_hash != GENESIS_HASH:
            raise ChainError("Genesis block has wrong previous_hash.")
        if not genesis.is_valid():
            raise ChainError("Genesis block hash mismatch — tampered.")

        for i in range(1, len(self._blocks)):
            current = self._blocks[i]
            previous = self._blocks[i - 1]

            if not current.is_valid():
                raise ChainError(
                    f"Block {i} hash mismatch — chain tampered at index {i}."
                )
            if current.previous_hash != previous.hash:
                raise ChainError(
                    f"Block {i} previous_hash does not match block {i-1} hash."
                )
            if current.index != i:
                raise ChainError(
                    f"Block {i} has wrong index {current.index}."
                )

    def is_valid(self) -> bool:
        """Return True if chain passes validation."""
        try:
            self.validate()
            return True
        except ChainError:
            return False

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def summary(self) -> dict:
        return {
            "height": self.height,
            "genesis_hash": self.genesis.hash,
            "tip_hash": self.tip.hash,
            "tip_index": self.tip.index,
            "valid": self.is_valid(),
        }

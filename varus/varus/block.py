"""Block model for the Varus sovereign chain."""

import hashlib
import json
import time
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Block:
    """A single block in the Varus sovereign chain."""

    index: int
    timestamp: float
    data: dict[str, Any]
    previous_hash: str
    nonce: int = 0
    hash: str = field(default="", init=False)

    def __post_init__(self) -> None:
        self.hash = self.compute_hash()

    def compute_hash(self) -> str:
        """Compute SHA-256 hash of block contents (excluding self.hash)."""
        block_dict = {
            "index": self.index,
            "timestamp": self.timestamp,
            "data": self.data,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
        }
        block_string = json.dumps(block_dict, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()

    def is_valid(self) -> bool:
        """Return True if stored hash matches computed hash."""
        return self.hash == self.compute_hash()

    def to_dict(self) -> dict:
        """Serialize block to dict."""
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "data": self.data,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "hash": self.hash,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Block":
        """Deserialize block from dict."""
        block = cls.__new__(cls)
        block.index = data["index"]
        block.timestamp = data["timestamp"]
        block.data = data["data"]
        block.previous_hash = data["previous_hash"]
        block.nonce = data["nonce"]
        block.hash = data["hash"]
        return block

    def __repr__(self) -> str:
        return (
            f"Block(index={self.index}, "
            f"hash={self.hash[:12]}..., "
            f"previous_hash={self.previous_hash[:12]}...)"
        )

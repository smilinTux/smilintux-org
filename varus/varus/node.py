"""Varus node daemon — maintains and validates the sovereign chain."""

import json
import logging
import signal
import sys
import threading
import time
from pathlib import Path
from typing import Any

from .chain import VarusChain

logger = logging.getLogger("varus.node")

DEFAULT_TICK = 10  # seconds between health checks
DEFAULT_SOCKET = Path("/tmp/varus_node.sock")
_STOP_EVENT = threading.Event()


# ---------------------------------------------------------------------------
# Inbox: simple file-based block submission queue
# ---------------------------------------------------------------------------

class BlockInbox:
    """Watch a directory for pending block requests written as JSON files."""

    def __init__(self, inbox_dir: Path) -> None:
        self.inbox_dir = inbox_dir
        self.inbox_dir.mkdir(parents=True, exist_ok=True)

    def pending(self) -> list[Path]:
        return sorted(self.inbox_dir.glob("*.json"))

    def consume(self, path: Path) -> dict[str, Any]:
        data = json.loads(path.read_text())
        path.unlink()
        return data


# ---------------------------------------------------------------------------
# VarusNode
# ---------------------------------------------------------------------------

class VarusNode:
    """
    Lightweight sovereign chain node.

    Responsibilities:
    - Load and validate the chain on start.
    - Accept new block data via the file-based inbox.
    - Periodically re-validate the chain and log health status.
    - Expose a simple status dict for introspection.
    """

    def __init__(
        self,
        chain_path: str | Path | None = None,
        inbox_dir: str | Path | None = None,
        tick: int = DEFAULT_TICK,
    ) -> None:
        chain_path = Path(chain_path) if chain_path else Path("varus_chain.json")
        inbox_dir = Path(inbox_dir) if inbox_dir else chain_path.parent / "varus_inbox"

        self.chain = VarusChain(chain_path)
        self.inbox = BlockInbox(inbox_dir)
        self.tick = tick
        self._running = False
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Load chain then enter the main loop (blocking)."""
        logger.info("Varus node starting…")
        self.chain.load()
        logger.info(
            "Chain loaded. height=%d tip=%s valid=%s",
            self.chain.height,
            self.chain.tip.hash[:12],
            self.chain.is_valid(),
        )

        self._running = True
        _STOP_EVENT.clear()
        self._install_signal_handlers()
        self._loop()

    def stop(self) -> None:
        logger.info("Varus node stopping.")
        self._running = False
        _STOP_EVENT.set()

    def _install_signal_handlers(self) -> None:
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, self._handle_signal)

    def _handle_signal(self, signum: int, frame: Any) -> None:
        logger.info("Signal %d received — shutting down.", signum)
        self.stop()

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        while self._running:
            self._process_inbox()
            self._health_check()
            _STOP_EVENT.wait(timeout=self.tick)

        logger.info("Node loop exited cleanly.")

    # ------------------------------------------------------------------
    # Inbox processing
    # ------------------------------------------------------------------

    def _process_inbox(self) -> None:
        for path in self.inbox.pending():
            try:
                data = self.inbox.consume(path)
                with self._lock:
                    block = self.chain.add_block(data)
                logger.info(
                    "Block appended: index=%d hash=%s",
                    block.index,
                    block.hash[:12],
                )
            except Exception as exc:
                logger.error("Failed to process inbox item %s: %s", path.name, exc)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    def _health_check(self) -> None:
        with self._lock:
            valid = self.chain.is_valid()
            height = self.chain.height
        if valid:
            logger.debug("Health OK — height=%d", height)
        else:
            logger.error("CHAIN INTEGRITY FAILURE — height=%d", height)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def status(self) -> dict:
        with self._lock:
            return {
                "running": self._running,
                "chain": self.chain.summary(),
                "inbox_pending": len(self.inbox.pending()),
            }

    # ------------------------------------------------------------------
    # Convenience: submit a block without going through the inbox
    # ------------------------------------------------------------------

    def submit_block(self, data: dict[str, Any]):
        """Thread-safe block submission (used by tests / programmatic API)."""
        with self._lock:
            return self.chain.add_block(data)

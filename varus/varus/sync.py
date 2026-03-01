"""P2P chain synchronization via SKComm FileTransport.

Export: serializes the local chain as a JSON envelope and drops it into
the SKComm FileTransport outbox directory so peers can pick it up.

Import: polls the FileTransport inbox for varus chain snapshots, validates
each received chain fully (per-block hashes + link integrity + genesis check),
then merges any blocks that extend the local tip (longest-chain rule).

Usage::

    from varus.sync import ChainSync
    from varus.chain import VarusChain

    chain = VarusChain("varus_chain.json")
    chain.load()

    sync = ChainSync(chain, agent_name="my-node")
    sync.export_chain(recipient="peer-node")   # push to outbox
    results = sync.import_chain()              # pull from inbox

skcomm is an optional dependency; an ImportError with a clear message is
raised if it is not installed.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path

from .block import Block
from .chain import GENESIS_HASH, ChainError, VarusChain

logger = logging.getLogger("varus.sync")

_ENVELOPE_TYPE = "varus_chain_snapshot"


class ChainSync:
    """Sync a VarusChain with peers using SKComm FileTransport.

    Parameters
    ----------
    chain:
        The local :class:`~varus.chain.VarusChain` (must already be loaded).
    agent_name:
        Identifier included in outgoing envelopes so receivers know the sender.
    outbox_path:
        Override the SKComm outbox directory (default: ``~/.skcomm/outbox``).
    inbox_path:
        Override the SKComm inbox directory (default: ``~/.skcomm/inbox``).
    """

    def __init__(
        self,
        chain: VarusChain,
        agent_name: str = "varus",
        outbox_path: Path | str | None = None,
        inbox_path: Path | str | None = None,
    ) -> None:
        self.chain = chain
        self.agent_name = agent_name
        self._outbox = (
            Path(outbox_path).expanduser()
            if outbox_path
            else Path("~/.skcomm/outbox").expanduser()
        )
        self._inbox = (
            Path(inbox_path).expanduser()
            if inbox_path
            else Path("~/.skcomm/inbox").expanduser()
        )

    # ------------------------------------------------------------------
    # Transport factory
    # ------------------------------------------------------------------

    def _make_transport(self):
        """Return a configured FileTransport (requires skcomm)."""
        try:
            from skcomm.transports.file import FileTransport  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "skcomm is required for P2P chain sync. "
                "Install with: pip install skcomm  "
                "or: pip install 'varus[sync]'"
            ) from exc
        return FileTransport(outbox_path=self._outbox, inbox_path=self._inbox)

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def export_chain(self, recipient: str = "peer") -> str:
        """Serialize the local chain and write it to the FileTransport outbox.

        Parameters
        ----------
        recipient:
            Target agent name.  The file transport uses this for logging only;
            actual routing is handled by the shared directory.

        Returns
        -------
        str
            The ``envelope_id`` of the snapshot that was written.

        Raises
        ------
        RuntimeError
            If the transport send fails.
        """
        transport = self._make_transport()

        envelope_id = f"varus-{uuid.uuid4().hex[:12]}"
        envelope = {
            "envelope_id": envelope_id,
            "type": _ENVELOPE_TYPE,
            "sender": self.agent_name,
            "timestamp": time.time(),
            "chain": [b.to_dict() for b in self.chain.all_blocks()],
        }
        envelope_bytes = json.dumps(envelope, separators=(",", ":")).encode()

        result = transport.send(envelope_bytes, recipient)
        if not result.success:
            raise RuntimeError(f"FileTransport.send failed: {result.error}")

        logger.info(
            "Exported chain height=%d envelope=%s recipient=%s",
            self.chain.height,
            envelope_id[:12],
            recipient,
        )
        return envelope_id

    # ------------------------------------------------------------------
    # Import
    # ------------------------------------------------------------------

    def import_chain(self) -> list[dict]:
        """Poll the FileTransport inbox for chain snapshots and merge new blocks.

        Each envelope is validated fully before any merge is attempted.
        Non-varus envelopes are silently skipped.

        Returns
        -------
        list[dict]
            One result dict per envelope processed.  Keys:

            - ``ok`` (bool) — whether the envelope was processed successfully.
            - ``envelope_id`` (str) — envelope identifier.
            - ``sender`` (str) — originating agent.
            - ``blocks_added`` (int) — blocks appended to local chain.
            - ``chain_height`` (int) — local chain height after merge.
            - ``error`` (str) — present only on failure.
            - ``skipped`` (bool) — present when the envelope was not a chain snapshot.
        """
        transport = self._make_transport()
        results: list[dict] = []
        for envelope_bytes in transport.receive():
            results.append(self._process_envelope(envelope_bytes))
        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _process_envelope(self, envelope_bytes: bytes) -> dict:
        """Validate and merge a single raw envelope."""
        try:
            envelope = json.loads(envelope_bytes)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Skipping non-JSON envelope: %s", exc)
            return {"ok": False, "error": f"JSON decode error: {exc}"}

        if envelope.get("type") != _ENVELOPE_TYPE:
            return {"ok": False, "skipped": True, "reason": "not a varus_chain_snapshot"}

        envelope_id = envelope.get("envelope_id", "?")
        sender = envelope.get("sender", "?")
        raw_blocks = envelope.get("chain", [])

        try:
            remote_blocks = _validate_remote_chain(raw_blocks)
        except ChainError as exc:
            logger.error(
                "Received invalid chain from sender=%s envelope=%s: %s",
                sender, envelope_id[:12], exc,
            )
            return {"ok": False, "envelope_id": envelope_id, "sender": sender, "error": str(exc)}

        added = self._merge_blocks(remote_blocks)
        logger.info(
            "Imported from sender=%s envelope=%s: blocks_added=%d height=%d",
            sender, envelope_id[:12], added, self.chain.height,
        )
        return {
            "ok": True,
            "envelope_id": envelope_id,
            "sender": sender,
            "blocks_added": added,
            "chain_height": self.chain.height,
        }

    def _merge_blocks(self, remote_blocks: list[Block]) -> int:
        """Append validated remote blocks that extend the local chain.

        Rules:
        1. Remote genesis hash must match local genesis hash.
        2. Overlapping blocks must hash-match (no forks accepted).
        3. Only strictly longer chains trigger an append (longest-chain rule).

        Returns
        -------
        int
            Number of blocks appended (0 if nothing was added).
        """
        if not remote_blocks:
            return 0

        local_genesis = self.chain.genesis
        if remote_blocks[0].hash != local_genesis.hash:
            logger.warning(
                "Remote genesis %s != local %s — ignoring snapshot.",
                remote_blocks[0].hash[:12],
                local_genesis.hash[:12],
            )
            return 0

        current_height = self.chain.height
        if len(remote_blocks) <= current_height:
            logger.debug(
                "Remote height %d not longer than local %d — nothing to merge.",
                len(remote_blocks),
                current_height,
            )
            return 0

        # Verify that the overlap is consistent (no fork)
        for i in range(current_height):
            if self.chain.get_block(i).hash != remote_blocks[i].hash:
                logger.error(
                    "Chain fork at index %d (local=%s remote=%s) — ignoring.",
                    i,
                    self.chain.get_block(i).hash[:12],
                    remote_blocks[i].hash[:12],
                )
                return 0

        # Append blocks beyond the local tip
        for block in remote_blocks[current_height:]:
            self.chain._blocks.append(block)  # preserve original hashes/timestamps

        self.chain.save()
        return len(remote_blocks) - current_height


# ------------------------------------------------------------------
# Module-level validation helper (no class state needed)
# ------------------------------------------------------------------

def _validate_remote_chain(raw_blocks: list) -> list[Block]:
    """Parse and fully validate a list of raw block dicts from a peer.

    Checks:
    - Non-empty
    - Each block's stored hash matches its computed hash
    - ``previous_hash`` links are consistent
    - ``index`` fields are sequential from 0
    - Genesis ``previous_hash`` equals the canonical sentinel

    Returns
    -------
    list[Block]
        Validated Block objects.

    Raises
    ------
    ChainError
        On any integrity violation.
    """
    if not raw_blocks:
        raise ChainError("Received empty chain.")

    blocks: list[Block] = [Block.from_dict(b) for b in raw_blocks]

    if blocks[0].previous_hash != GENESIS_HASH:
        raise ChainError(
            f"Genesis previous_hash {blocks[0].previous_hash[:12]!r} "
            f"does not match sentinel {GENESIS_HASH[:12]!r}."
        )

    for i, block in enumerate(blocks):
        if not block.is_valid():
            raise ChainError(
                f"Block {i} hash mismatch in received chain (tampered or corrupt)."
            )
        if block.index != i:
            raise ChainError(
                f"Block at position {i} has wrong index field {block.index}."
            )

    for i in range(1, len(blocks)):
        if blocks[i].previous_hash != blocks[i - 1].hash:
            raise ChainError(
                f"Chain link broken between block {i - 1} and {i} in received chain."
            )

    return blocks

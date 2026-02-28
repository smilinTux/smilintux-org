"""Varus CLI — create blocks and query chain state."""

import argparse
import json
import logging
import sys
from pathlib import Path

from .chain import VarusChain, ChainError
from .node import VarusNode

DEFAULT_CHAIN = Path("varus_chain.json")


def _get_chain(args: argparse.Namespace) -> VarusChain:
    chain = VarusChain(getattr(args, "chain", DEFAULT_CHAIN))
    chain.load()
    return chain


# ---------------------------------------------------------------------------
# Sub-command handlers
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> int:
    """Initialise a new chain (genesis block only)."""
    path = Path(args.chain)
    if path.exists() and not args.force:
        print(f"Chain already exists at {path}. Use --force to reinitialise.")
        return 1
    if path.exists() and args.force:
        path.unlink()
    chain = VarusChain(path)
    chain.load()
    genesis = chain.genesis
    print(f"Genesis block created.")
    print(f"  index:     {genesis.index}")
    print(f"  hash:      {genesis.hash}")
    print(f"  chain:     {path}")
    return 0


def cmd_add(args: argparse.Namespace) -> int:
    """Append a new block with JSON data."""
    try:
        data = json.loads(args.data)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON data: {exc}", file=sys.stderr)
        return 1

    chain = _get_chain(args)
    block = chain.add_block(data)
    print(f"Block appended.")
    print(f"  index:         {block.index}")
    print(f"  hash:          {block.hash}")
    print(f"  previous_hash: {block.previous_hash}")
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    """Display a block by index."""
    chain = _get_chain(args)
    try:
        block = chain.get_block(args.index)
    except IndexError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(block.to_dict(), indent=2))
    return 0


def cmd_tip(args: argparse.Namespace) -> int:
    """Display the latest block."""
    chain = _get_chain(args)
    print(json.dumps(chain.tip.to_dict(), indent=2))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    """Display chain summary."""
    chain = _get_chain(args)
    summary = chain.summary()
    print(json.dumps(summary, indent=2))
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    """List all blocks (compact view)."""
    chain = _get_chain(args)
    for block in chain.all_blocks():
        print(
            f"[{block.index:>6}]  {block.hash[:16]}...  prev={block.previous_hash[:12]}..."
            f"  ts={block.timestamp:.0f}"
        )
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate the entire chain."""
    chain = _get_chain(args)
    try:
        chain.validate()
        print(f"Chain is VALID. height={chain.height}")
        return 0
    except ChainError as exc:
        print(f"Chain is INVALID: {exc}", file=sys.stderr)
        return 2


def cmd_daemon(args: argparse.Namespace) -> int:
    """Start the Varus node daemon (blocking)."""
    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    node = VarusNode(
        chain_path=args.chain,
        inbox_dir=args.inbox,
        tick=args.tick,
    )
    node.start()
    return 0


def cmd_submit(args: argparse.Namespace) -> int:
    """Submit a block to the node inbox (for daemon processing)."""
    try:
        data = json.loads(args.data)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON data: {exc}", file=sys.stderr)
        return 1

    inbox_dir = Path(args.inbox)
    inbox_dir.mkdir(parents=True, exist_ok=True)

    import time, uuid
    filename = f"{time.time():.6f}_{uuid.uuid4().hex[:8]}.json"
    (inbox_dir / filename).write_text(json.dumps(data))
    print(f"Submitted to inbox: {filename}")
    return 0


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="varus",
        description="Varus sovereign chain CLI",
    )
    parser.add_argument(
        "--chain",
        default=str(DEFAULT_CHAIN),
        help="Path to chain JSON file (default: varus_chain.json)",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = sub.add_parser("init", help="Initialise a new chain")
    p_init.add_argument("--force", action="store_true", help="Overwrite existing chain")
    p_init.set_defaults(func=cmd_init)

    # add
    p_add = sub.add_parser("add", help="Append a block")
    p_add.add_argument("data", help='JSON data string, e.g. \'{"key": "value"}\'')
    p_add.set_defaults(func=cmd_add)

    # get
    p_get = sub.add_parser("get", help="Get block by index")
    p_get.add_argument("index", type=int, help="Block index")
    p_get.set_defaults(func=cmd_get)

    # tip
    p_tip = sub.add_parser("tip", help="Show the latest block")
    p_tip.set_defaults(func=cmd_tip)

    # status
    p_status = sub.add_parser("status", help="Show chain summary")
    p_status.set_defaults(func=cmd_status)

    # list
    p_list = sub.add_parser("list", help="List all blocks")
    p_list.set_defaults(func=cmd_list)

    # validate
    p_val = sub.add_parser("validate", help="Validate chain integrity")
    p_val.set_defaults(func=cmd_validate)

    # daemon
    p_daemon = sub.add_parser("daemon", help="Start the node daemon")
    p_daemon.add_argument("--inbox", default=None, help="Inbox directory path")
    p_daemon.add_argument(
        "--tick", type=int, default=10, help="Health-check interval in seconds"
    )
    p_daemon.add_argument("--debug", action="store_true", help="Enable debug logging")
    p_daemon.set_defaults(func=cmd_daemon)

    # submit
    p_submit = sub.add_parser("submit", help="Submit block data to daemon inbox")
    p_submit.add_argument("data", help="JSON data string")
    p_submit.add_argument(
        "--inbox", default="varus_inbox", help="Inbox directory path"
    )
    p_submit.set_defaults(func=cmd_submit)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

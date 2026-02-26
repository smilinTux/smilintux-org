#!/usr/bin/env python3
"""
SKComm Bridge — interactive chat window over the REST API.

Polls the inbox every POLL_INTERVAL seconds and prints new messages.
Accepts user input and sends via the REST API to any mesh peer.

Usage:
    python scripts/skcomm_bridge.py
    python scripts/skcomm_bridge.py --api http://remote-host:9384 --to lumina
    python scripts/skcomm_bridge.py --poll 10 --identity jarvis

Set SKCOMM_API_URL env var to override the default localhost endpoint.
Prerequisites: pip install requests  +  skcomm serve
"""

from __future__ import annotations

import argparse
import json
import os
import readline  # noqa: F401  enables arrow keys / history in input()
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_API_URL: str = os.environ.get("SKCOMM_API_URL", "http://127.0.0.1:9384")
DEFAULT_POLL_INTERVAL: int = 5
SEND_ENDPOINT: str = "/api/v1/send"
INBOX_ENDPOINT: str = "/api/v1/inbox"
STATUS_ENDPOINT: str = "/api/v1/status"
HEALTH_ENDPOINT: str = "/"

# ANSI colours (gracefully disabled on non-TTY)
_COLOUR = sys.stdout.isatty()

def _c(code: str, text: str) -> str:
    """Wrap text in ANSI colour code if colour is enabled."""
    return f"\033[{code}m{text}\033[0m" if _COLOUR else text

GREEN   = lambda t: _c("32", t)
CYAN    = lambda t: _c("36", t)
YELLOW  = lambda t: _c("33", t)
RED     = lambda t: _c("31", t)
BOLD    = lambda t: _c("1",  t)
DIM     = lambda t: _c("2",  t)


# ---------------------------------------------------------------------------
# API client helpers
# ---------------------------------------------------------------------------

class SKCommClient:
    """Thin HTTP client wrapping the SKComm REST API.

    Args:
        base_url: Base URL of the running SKComm API server.
        timeout: Request timeout in seconds.
    """

    def __init__(self, base_url: str = DEFAULT_API_URL, timeout: int = 10) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    def health(self) -> Optional[Dict[str, Any]]:
        """Ping the API server.

        Returns:
            Health dict or None if unreachable.
        """
        try:
            resp = self._session.get(
                f"{self.base_url}{HEALTH_ENDPOINT}", timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def status(self) -> Optional[Dict[str, Any]]:
        """Get full SKComm status including identity and transport health.

        Returns:
            Status dict or None on error.
        """
        try:
            resp = self._session.get(
                f"{self.base_url}{STATUS_ENDPOINT}", timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            print(RED(f"[bridge] Status error: {exc}"), file=sys.stderr)
            return None

    def inbox(self) -> List[Dict[str, Any]]:
        """Poll the inbox for new messages.

        Returns:
            List of message envelope dicts (may be empty).
        """
        try:
            resp = self._session.get(
                f"{self.base_url}{INBOX_ENDPOINT}", timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            print(RED(f"[bridge] Inbox poll error: {exc}"), file=sys.stderr)
            return []

    def send(
        self,
        recipient: str,
        message: str,
        urgency: str = "normal",
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a message via the REST API.

        Args:
            recipient: Peer name or fingerprint.
            message: Plaintext message content.
            urgency: low | normal | high | critical.
            thread_id: Optional conversation thread identifier.

        Returns:
            API response dict with delivered status and envelope_id.

        Raises:
            requests.HTTPError: On non-2xx response.
        """
        payload: Dict[str, Any] = {
            "recipient": recipient,
            "message": message,
            "urgency": urgency,
        }
        if thread_id:
            payload["thread_id"] = thread_id

        resp = self._session.post(
            f"{self.base_url}{SEND_ENDPOINT}",
            data=json.dumps(payload),
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Message formatting
# ---------------------------------------------------------------------------

def _format_timestamp(iso: Optional[str]) -> str:
    """Convert ISO timestamp to local HH:MM:SS.

    Args:
        iso: ISO 8601 string (may be None).

    Returns:
        Formatted time string.
    """
    if not iso:
        return "?"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        local = dt.astimezone()
        return local.strftime("%H:%M:%S")
    except (ValueError, OSError):
        return iso[:19]


def _urgency_label(urgency: str) -> str:
    """Colour-coded urgency label.

    Args:
        urgency: Urgency string value.

    Returns:
        Formatted label string.
    """
    mapping = {
        "critical": RED(BOLD("CRITICAL")),
        "high":     YELLOW("HIGH"),
        "normal":   "",
        "low":      DIM("low"),
    }
    return mapping.get(urgency.lower(), urgency)


def print_message(envelope: Dict[str, Any]) -> None:
    """Print a received envelope to stdout in a readable format.

    Args:
        envelope: Message envelope dict from the API.
    """
    sender    = envelope.get("sender", "?")
    content   = envelope.get("content", "")
    urgency   = envelope.get("urgency", "normal")
    ts        = _format_timestamp(envelope.get("created_at"))
    thread    = envelope.get("thread_id") or ""
    enc_mark  = "🔒" if envelope.get("encrypted") else "  "
    urg_label = _urgency_label(urgency)

    thread_str = DIM(f" [{thread[:12]}]") if thread else ""
    urg_str    = f" {urg_label}" if urg_label else ""

    print(
        f"\n{enc_mark} {DIM(ts)} {CYAN(BOLD(sender))}{thread_str}{urg_str}"
        f"\n   {content}"
    )


# ---------------------------------------------------------------------------
# Bridge main loop
# ---------------------------------------------------------------------------

def _wait_for_server(client: SKCommClient, retries: int = 12) -> bool:
    """Block until the API server is reachable.

    Args:
        client: Configured SKCommClient.
        retries: Maximum number of 5-second retry cycles.

    Returns:
        True if the server became reachable, False on timeout.
    """
    for attempt in range(retries):
        result = client.health()
        if result:
            return True
        if attempt == 0:
            print(YELLOW(f"[bridge] Waiting for API at {client.base_url}..."))
        time.sleep(5)
    return False


def _print_banner(client: SKCommClient) -> str:
    """Print startup banner with identity and transport summary.

    Args:
        client: Connected SKCommClient.

    Returns:
        The local agent identity name (for use as sender label).
    """
    st = client.status() or {}
    identity = st.get("identity", {})
    name     = identity.get("name", "unknown")
    tc       = st.get("transport_count", 0)
    mode     = st.get("default_mode", "?")
    fp       = identity.get("fingerprint", "")
    fp_short = fp[:16] + "…" if fp and len(fp) > 16 else fp or "none"

    print()
    print(BOLD("╔═══════════════════════════════════╗"))
    print(BOLD("║     SKComm Bridge — Chat Window    ║"))
    print(BOLD("╚═══════════════════════════════════╝"))
    print(f"  Identity:   {CYAN(BOLD(name))}")
    print(f"  Fingerprint:{DIM(f' {fp_short}')}")
    print(f"  Transports: {GREEN(str(tc))} active  (mode: {mode})")
    print(f"  API:        {DIM(client.base_url)}")
    print()
    print(DIM("  Type a message and press Enter to send."))
    print(DIM("  /to <peer>   — switch recipient"))
    print(DIM("  /peers       — list known peers"))
    print(DIM("  /status      — refresh server status"))
    print(DIM("  /quit        — exit"))
    print()
    return name


def run_bridge(
    api_url: str,
    default_recipient: Optional[str],
    poll_interval: int,
    identity_override: Optional[str],
) -> None:
    """Main bridge loop: poll inbox + interactive send.

    Args:
        api_url: SKComm REST API base URL.
        default_recipient: Default message recipient name.
        poll_interval: Seconds between inbox polls.
        identity_override: Override display name (cosmetic only).
    """
    client    = SKCommClient(base_url=api_url)
    recipient = default_recipient or ""
    seen_ids: Set[str] = set()

    if not _wait_for_server(client):
        print(RED(f"[bridge] Cannot reach {api_url}. Is `skcomm serve` running?"))
        sys.exit(1)

    my_name = identity_override or _print_banner(client)

    if not recipient:
        try:
            recipient = input(f"  {BOLD('Send to')} (peer name): ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return

    print(GREEN(f"\n  Chatting with {BOLD(recipient)} — polling every {poll_interval}s"))
    print(DIM("  ─────────────────────────────────────\n"))

    last_poll = 0.0

    while True:
        now = time.monotonic()

        # ── Inbox poll ───────────────────────────────────────────────────
        if now - last_poll >= poll_interval:
            last_poll = now
            envelopes = client.inbox()
            new_msgs = [e for e in envelopes if e.get("envelope_id") not in seen_ids]
            for env in new_msgs:
                seen_ids.add(env.get("envelope_id", ""))
                print_message(env)
            if new_msgs:
                # Re-print the prompt after message display
                print(f"\n{BOLD(my_name)} > ", end="", flush=True)

        # ── User input (non-blocking via select on stdin) ─────────────────
        try:
            import select as _select
            ready, _, _ = _select.select([sys.stdin], [], [], poll_interval)
            if not ready:
                continue
            line = sys.stdin.readline()
        except (ImportError, OSError):
            # Fallback: blocking input (no background polling)
            try:
                line = input(f"{BOLD(my_name)} > ")
            except EOFError:
                print()
                break
            line = (line or "") + "\n"

        if not line:
            break

        text = line.strip()
        if not text:
            print(f"{BOLD(my_name)} > ", end="", flush=True)
            continue

        # ── Commands ──────────────────────────────────────────────────────
        if text.startswith("/quit") or text.startswith("/exit"):
            print(DIM("\n  [bridge] Goodbye."))
            break

        if text.startswith("/to "):
            new_peer = text[4:].strip()
            if new_peer:
                recipient = new_peer
                print(GREEN(f"  → Now sending to: {BOLD(recipient)}"))
            print(f"{BOLD(my_name)} > ", end="", flush=True)
            continue

        if text == "/peers":
            try:
                resp = client._session.get(f"{api_url}/api/v1/peers", timeout=10)
                peers = resp.json()
                if peers:
                    print(f"\n  {len(peers)} peer(s):")
                    for p in peers:
                        transports = ", ".join(
                            t.get("transport", "?") for t in p.get("transports", [])
                        ) or "no transports"
                        print(f"    {CYAN(p['name']):20} [{transports}]")
                else:
                    print(DIM("  No peers in directory."))
            except Exception as exc:
                print(RED(f"  Error: {exc}"))
            print(f"\n{BOLD(my_name)} > ", end="", flush=True)
            continue

        if text == "/status":
            st = client.status() or {}
            ident = st.get("identity", {})
            print(f"\n  Identity: {CYAN(ident.get('name', '?'))}")
            for t_name, t_info in st.get("transports", {}).items():
                t_status = t_info.get("status", "?") if isinstance(t_info, dict) else str(t_info)
                colour = GREEN if t_status == "available" else YELLOW
                print(f"  {t_name:14} {colour(t_status)}")
            print(f"\n{BOLD(my_name)} > ", end="", flush=True)
            continue

        # ── Send message ──────────────────────────────────────────────────
        if not recipient:
            print(YELLOW("  No recipient set. Use /to <peer>"))
            print(f"{BOLD(my_name)} > ", end="", flush=True)
            continue

        try:
            result = client.send(recipient=recipient, message=text)
            delivered = result.get("delivered", False)
            transport = result.get("transport_used", "?")
            env_id    = result.get("envelope_id", "?")[:12]

            if delivered:
                print(
                    DIM(f"  ✓ sent via {transport}  [{env_id}]")
                )
            else:
                attempts = result.get("attempts", [])
                errors = [a.get("error", "?") for a in attempts if a.get("error")]
                print(RED(f"  ✗ delivery failed: {'; '.join(errors) or 'unknown error'}"))

        except requests.HTTPError as exc:
            print(RED(f"  ✗ API error: {exc.response.status_code} — {exc.response.text[:120]}"))
        except Exception as exc:
            print(RED(f"  ✗ Error: {exc}"))

        print(f"{BOLD(my_name)} > ", end="", flush=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser.

    Returns:
        Configured ArgumentParser.
    """
    p = argparse.ArgumentParser(
        prog="skcomm_bridge",
        description="Interactive chat window over the SKComm REST API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python scripts/skcomm_bridge.py\n"
            "  python scripts/skcomm_bridge.py --to lumina\n"
            "  python scripts/skcomm_bridge.py --api http://192.168.1.42:9384 --to opus\n"
        ),
    )
    p.add_argument("--api", default=DEFAULT_API_URL, metavar="URL",
                   help=f"API base URL (default: {DEFAULT_API_URL}; env: SKCOMM_API_URL)")
    p.add_argument("--to", default=None, metavar="PEER",
                   help="Default recipient (prompted if not set)")
    p.add_argument("--poll", type=int, default=DEFAULT_POLL_INTERVAL, metavar="SECS",
                   help=f"Inbox poll interval in seconds (default: {DEFAULT_POLL_INTERVAL})")
    p.add_argument("--identity", default=None, metavar="NAME",
                   help="Override the prompt display name")
    return p


def main() -> None:
    """CLI entry point for the SKComm bridge."""
    args = _build_parser().parse_args()
    try:
        run_bridge(
            api_url=args.api,
            default_recipient=args.to,
            poll_interval=args.poll,
            identity_override=args.identity,
        )
    except KeyboardInterrupt:
        print(DIM("\n\n  [bridge] Interrupted. Goodbye."))
        sys.exit(0)


if __name__ == "__main__":
    main()

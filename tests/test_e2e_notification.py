"""tests/test_e2e_notification.py

End-to-end notification pipeline test.

Pipeline under test
-------------------
    1. A test message is injected into the notification pipeline via the
       send_notification MCP tool (``_handle_send_notification``).  This is
       the same entry-point that the consciousness loop calls when the LLM
       decides to notify the user, and the same entry-point reached when a
       SKComm .skc.json envelope is processed and routed to the tool.

    2. The tool calls ``notify-send`` (mocked — no display required) and then
       calls ``memory_engine.store()`` with ``tags=["notification"]``.

    3. The test polls the memory store for up to 30 s until the tagged entry
       appears (or until the budget is exhausted).

    4. Assert: at least one memory with ``tag=notification`` is found,
       containing the injected title and body text.

    Additionally, ``TestSKCommEnvelopeInjection`` demonstrates the SKComm
    envelope-drop injection path: a ``.skc.json`` file is written to the
    agent inbox (simulating delivery by SKComm or Syncthing), the message
    payload is extracted, and the notification tool is invoked — proving
    that any delivery route that reaches ``_handle_send_notification``
    produces the correct memory-pipeline outcome.

Related coordination task
--------------------------
    [040fd134] Add end-to-end notification test: message → popup

Running
-------
    # From the monorepo root:
    pytest tests/test_e2e_notification.py -v -s -m e2e

    # Fast (no e2e tag guard):
    pytest tests/test_e2e_notification.py -v -s

Markers
-------
    e2e — marks the full pipeline tests; excluded by skcapstone default
          addopts but always runnable from the root monorepo.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.e2e

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_TITLE = "E2E Test: Notification Pipeline [040fd134]"
_BODY = "Injected by test_e2e_notification — proving the full notification pipeline."
_POLL_INTERVAL = 0.1  # seconds between memory-store poll attempts
_TIMEOUT = 30.0       # maximum seconds to wait for memory to appear


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_mock_proc() -> AsyncMock:
    """Return an AsyncMock simulating a successful ``notify-send`` subprocess."""
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))
    return mock_proc


def _poll_for_notification_memory(
    home: Path,
    title_fragment: str,
    timeout: float = _TIMEOUT,
) -> list:
    """Poll the memory store until a notification memory appears or timeout.

    Args:
        home: Agent home directory (temp path).
        title_fragment: Substring expected in the memory ``content`` field.
        timeout: Maximum polling duration in seconds.

    Returns:
        List of matching MemoryEntry objects; empty on timeout.
    """
    from skcapstone.memory_engine import list_memories

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        entries = list_memories(home=home, tags=["notification"])
        matching = [e for e in entries if title_fragment in e.content]
        if matching:
            return matching
        time.sleep(_POLL_INTERVAL)
    return []


# ---------------------------------------------------------------------------
# Test class 1: direct injection via the notification MCP tool
# ---------------------------------------------------------------------------


class TestNotificationPipelineE2E:
    """Full pipeline: send_notification → notify-send → memory[tag=notification]."""

    def test_notification_stored_in_memory_within_30s(self, tmp_path: Path) -> None:
        """Happy path: tool stores a notification memory within the 30-second budget.

        Steps
        -----
        1. Inject: call ``_handle_send_notification()`` with test title + body.
        2. Wait:   poll memory store for up to 30 s.
        3. Search: ``list_memories(tags=["notification"])``.
        4. Assert: matching entry found and ``tag=notification`` present.
        """
        from skcapstone.mcp_tools.notification_tools import _handle_send_notification

        agent_home = tmp_path / ".skcapstone"
        agent_home.mkdir()

        with (
            patch(
                "skcapstone.mcp_tools.notification_tools._home",
                return_value=agent_home,
            ),
            patch(
                "asyncio.create_subprocess_exec",
                new=AsyncMock(return_value=_make_mock_proc()),
            ),
        ):
            result = asyncio.run(
                _handle_send_notification({"title": _TITLE, "body": _BODY})
            )

        # --- Step 2 / 3: tool response ---
        response = json.loads(result[0].text)
        assert response.get("sent") is True, (
            f"Tool reported failure — pipeline did not fire: {result[0].text}"
        )
        assert "timestamp" in response

        # --- Step 4: memory search (with 30-second budget) ---
        found = _poll_for_notification_memory(agent_home, title_fragment=_TITLE)

        assert found, (
            f"No memory with tag=notification found within {_TIMEOUT} s. "
            "The notification pipeline failed to persist the event. "
            "Check that memory_engine.store() is reachable from the tool handler."
        )
        assert any("notification" in e.tags for e in found), (
            "Memory found but tag='notification' is absent from the tags list."
        )

    def test_notify_send_called_with_correct_args(self, tmp_path: Path) -> None:
        """notify-send is invoked with --urgency, title, and body in the right order."""
        from skcapstone.mcp_tools.notification_tools import _handle_send_notification

        agent_home = tmp_path / ".skcapstone"
        agent_home.mkdir()

        captured: list[str] = []

        async def _capture(*args, **_kwargs):
            captured.extend(args)
            return _make_mock_proc()

        with (
            patch(
                "skcapstone.mcp_tools.notification_tools._home",
                return_value=agent_home,
            ),
            patch("asyncio.create_subprocess_exec", new=AsyncMock(side_effect=_capture)),
        ):
            asyncio.run(
                _handle_send_notification(
                    {"title": "Urgency Check", "body": "Low urgency body.", "urgency": "low"}
                )
            )

        assert "notify-send" in captured, (
            f"notify-send binary not in subprocess args: {captured}"
        )
        assert "--urgency" in captured
        urgency_idx = captured.index("--urgency")
        assert captured[urgency_idx + 1] == "low", (
            f"Expected urgency 'low', got {captured[urgency_idx + 1]!r}"
        )
        assert "Urgency Check" in captured
        assert "Low urgency body." in captured

    def test_memory_content_contains_title_and_body(self, tmp_path: Path) -> None:
        """Memory content includes both the notification title and body verbatim."""
        from skcapstone.mcp_tools.notification_tools import _handle_send_notification
        from skcapstone.memory_engine import list_memories

        agent_home = tmp_path / ".skcapstone"
        agent_home.mkdir()

        unique_title = "ContentVerify-040fd134"
        unique_body = "Body text for content verification."

        with (
            patch(
                "skcapstone.mcp_tools.notification_tools._home",
                return_value=agent_home,
            ),
            patch(
                "asyncio.create_subprocess_exec",
                new=AsyncMock(return_value=_make_mock_proc()),
            ),
        ):
            asyncio.run(
                _handle_send_notification({"title": unique_title, "body": unique_body})
            )

        found = _poll_for_notification_memory(agent_home, title_fragment=unique_title)
        assert found, f"Notification memory not found (title={unique_title!r})."

        mem = found[0]
        assert unique_title in mem.content, (
            f"Title {unique_title!r} not in memory content: {mem.content!r}"
        )
        assert unique_body in mem.content, (
            f"Body {unique_body!r} not in memory content: {mem.content!r}"
        )
        assert mem.source == "mcp:send_notification", (
            f"Expected source 'mcp:send_notification', got {mem.source!r}"
        )
        assert "notification" in mem.tags

    def test_multiple_notifications_each_stored(self, tmp_path: Path) -> None:
        """Two successive notifications both appear in memory independently."""
        from skcapstone.mcp_tools.notification_tools import _handle_send_notification
        from skcapstone.memory_engine import list_memories

        agent_home = tmp_path / ".skcapstone"
        agent_home.mkdir()

        titles = ["First-040fd134", "Second-040fd134"]

        for title in titles:
            with (
                patch(
                    "skcapstone.mcp_tools.notification_tools._home",
                    return_value=agent_home,
                ),
                patch(
                    "asyncio.create_subprocess_exec",
                    new=AsyncMock(return_value=_make_mock_proc()),
                ),
            ):
                asyncio.run(
                    _handle_send_notification({"title": title, "body": f"Body for {title}"})
                )

        # Both memories must be present
        for title in titles:
            found = _poll_for_notification_memory(agent_home, title_fragment=title)
            assert found, (
                f"Notification memory not found for title={title!r}. "
                "Expected both notifications to be persisted independently."
            )


# ---------------------------------------------------------------------------
# Test class 2: SKComm envelope-drop injection path
# ---------------------------------------------------------------------------


class TestSKCommEnvelopeInjection:
    """Demonstrate injection via a dropped .skc.json SKComm envelope.

    In production, SKComm (or Syncthing) delivers a .skc.json file to the
    agent's inbox.  The consciousness loop picks it up via inotify/watchdog,
    processes the payload with the LLM, and issues a tool call.  Here we
    exercise the envelope-drop pattern directly and verify that routing the
    extracted payload to ``_handle_send_notification`` stores the memory.
    """

    def test_skcomm_envelope_triggers_notification_memory(self, tmp_path: Path) -> None:
        """SKComm envelope → extract payload → invoke tool → memory[tag=notification].

        Steps
        -----
        1. Inject:  write a .skc.json envelope to the agent inbox directory,
                    simulating delivery by SKComm / Syncthing.
        2. Route:   extract the payload and pass it to _handle_send_notification
                    (simulating the consciousness loop's tool-call dispatch).
        3. Wait:    poll memory for up to 30 s.
        4. Assert:  memory with tag=notification is found.
        """
        from skcapstone.mcp_tools.notification_tools import _handle_send_notification

        agent_home = tmp_path / ".skcapstone"
        inbox_dir = agent_home / "sync" / "comms" / "inbox"
        inbox_dir.mkdir(parents=True)

        # --- Step 1: inject via SKComm envelope drop ---
        notif_title = "SKComm-Injected-040fd134"
        notif_body = "Notification triggered via .skc.json envelope drop."
        envelope = {
            "sender": "e2e-test-peer",
            "recipient": "",
            "payload": {
                "content": notif_body,
                "content_type": "text",
                "tool_call": {
                    "name": "send_notification",
                    "args": {"title": notif_title, "body": notif_body},
                },
            },
            "message_id": f"e2e-notif-{int(time.time() * 1000)}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
        }
        msg_file = inbox_dir / f"{envelope['message_id']}.skc.json"
        msg_file.write_text(json.dumps(envelope, indent=2))
        assert msg_file.exists(), "Envelope file not written to inbox"

        # --- Step 2: extract tool-call args and dispatch (simulates loop routing) ---
        received = json.loads(msg_file.read_text())
        tool_args = received["payload"]["tool_call"]["args"]

        with (
            patch(
                "skcapstone.mcp_tools.notification_tools._home",
                return_value=agent_home,
            ),
            patch(
                "asyncio.create_subprocess_exec",
                new=AsyncMock(return_value=_make_mock_proc()),
            ),
        ):
            result = asyncio.run(_handle_send_notification(tool_args))

        response = json.loads(result[0].text)
        assert response.get("sent") is True, (
            f"Tool handler returned failure from SKComm-injected args: {result[0].text}"
        )

        # --- Step 3 / 4: poll and assert ---
        found = _poll_for_notification_memory(agent_home, title_fragment=notif_title)
        assert found, (
            f"No notification memory found within {_TIMEOUT} s after SKComm envelope injection. "
            f"Inbox contents: {[f.name for f in inbox_dir.iterdir()]}"
        )
        assert "notification" in found[0].tags

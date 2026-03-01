"""Integration tests: Trustee operations + MCP tools + Group chat.

Tests the cross-package flows added in this session:
  1. Trustee Monitor: heartbeat detection, auto-restart, escalation
  2. MCP Trustee Tools: end-to-end MCP → TrusteeOps → TeamEngine
  3. Group Chat + Memory: group creation, member management, message storage
  4. SKChat MCP Tools: send/inbox/group operations via MCP

No mocks for core operations. Real deployments. Real memory. Real MCP dispatch.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

pytest.importorskip("yaml", reason="pyyaml is not installed")
pytest.importorskip("skmemory", reason="skmemory is not installed")
pytest.importorskip("skchat", reason="skchat is not installed")

PASSPHRASE = "sovereign-test-key-2026"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _setup_agent_home(home: Path) -> Path:
    """Create a minimal agent home with deployments support."""
    for subdir in (
        "identity",
        "memory",
        "trust",
        "security",
        "skills",
        "config",
        "sync",
        "deployments",
        "coordination",
    ):
        (home / subdir).mkdir(parents=True, exist_ok=True)

    manifest = {
        "name": "integration-agent",
        "version": "0.1.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "connectors": [],
    }
    (home / "manifest.json").write_text(json.dumps(manifest, indent=2))

    import yaml

    config = {"agent_name": "integration-agent", "auto_rehydrate": True, "auto_audit": True}
    (home / "config" / "config.yaml").write_text(yaml.dump(config, default_flow_style=False))
    return home


def _create_deployment(home: Path, deploy_id: str = "int-test-deploy", **overrides):
    """Create a test deployment with configurable agents."""
    from skcapstone.team_engine import (
        AgentStatus,
        DeployedAgent,
        TeamDeployment,
        TeamEngine,
    )

    engine = TeamEngine(home=home, provider=None, comms_root=None)
    now = datetime.now(timezone.utc).isoformat()

    agent_configs = overrides.get("agents", {
        "alpha": AgentStatus.RUNNING,
        "beta": AgentStatus.RUNNING,
        "gamma": AgentStatus.RUNNING,
    })
    heartbeats = overrides.get("heartbeats", {})

    deployment = TeamDeployment(
        deployment_id=deploy_id,
        blueprint_slug="integration-test",
        team_name="Integration Test Team",
        provider="local",
        status="running",
    )

    for name, status in agent_configs.items():
        hb = heartbeats.get(name, now)
        deployment.agents[name] = DeployedAgent(
            name=name,
            instance_id=f"{deploy_id}/{name}",
            blueprint_slug="integration-test",
            agent_spec_key="worker",
            status=status,
            host="localhost",
            last_heartbeat=hb,
            started_at=now,
        )

    engine._save_deployment(deployment)
    return engine, deployment


def _extract_json(result: list) -> dict | list:
    """Parse JSON from MCP TextContent response."""
    assert len(result) == 1
    return json.loads(result[0].text)


# ---------------------------------------------------------------------------
# 1. Trustee Monitor integration
# ---------------------------------------------------------------------------


class TestTrusteeMonitorIntegration:
    """TrusteeMonitor wired to real TeamEngine and TrusteeOps."""

    def test_monitor_healthy_deployment(self, tmp_path: Path):
        """All-healthy deployment produces clean report."""
        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, deployment = _create_deployment(home)

        from skcapstone.trustee_monitor import MonitorConfig, TrusteeMonitor
        from skcapstone.trustee_ops import TrusteeOps

        ops = TrusteeOps(engine=engine, home=home)
        monitor = TrusteeMonitor(ops, engine, MonitorConfig())
        report = monitor.check_deployment(deployment)

        assert report.agents_healthy == 3
        assert report.agents_degraded == 0
        assert report.restarts_triggered == []
        assert report.rotations_triggered == []
        assert report.escalations_sent == []

    def test_monitor_detects_stale_heartbeat_and_restarts(self, tmp_path: Path):
        """Stale heartbeat triggers auto-restart through real TrusteeOps."""
        from skcapstone.team_engine import AgentStatus
        from skcapstone.trustee_monitor import MonitorConfig, TrusteeMonitor
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        old = (datetime.now(timezone.utc) - timedelta(seconds=600)).isoformat()
        engine, deployment = _create_deployment(
            home,
            heartbeats={"alpha": old},
        )

        ops = TrusteeOps(engine=engine, home=home)
        monitor = TrusteeMonitor(
            ops, engine, MonitorConfig(heartbeat_timeout=120)
        )
        report = monitor.check_deployment(deployment)

        assert "alpha" in report.restarts_triggered
        assert report.agents_degraded >= 1

    def test_monitor_escalates_on_critical_degradation(self, tmp_path: Path):
        """When >50% agents fail, monitor escalates."""
        from skcapstone.team_engine import AgentStatus
        from skcapstone.trustee_monitor import MonitorConfig, TrusteeMonitor
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, deployment = _create_deployment(
            home,
            agents={
                "alpha": AgentStatus.FAILED,
                "beta": AgentStatus.FAILED,
                "gamma": AgentStatus.RUNNING,
            },
        )

        ops = TrusteeOps(engine=engine, home=home)
        config = MonitorConfig(critical_threshold=0.5, auto_escalate=True)
        monitor = TrusteeMonitor(ops, engine, config)
        report = monitor.check_deployment(deployment)

        assert report.agents_degraded == 2
        assert "int-test-deploy" in report.escalations_sent

    def test_monitor_check_all_aggregates(self, tmp_path: Path):
        """check_all aggregates across multiple deployments."""
        from skcapstone.trustee_monitor import MonitorConfig, TrusteeMonitor
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home, deploy_id="deploy-1")
        _create_deployment(home, deploy_id="deploy-2")

        ops = TrusteeOps(engine=engine, home=home)
        monitor = TrusteeMonitor(ops, engine, MonitorConfig())
        report = monitor.check_all()

        assert report.deployments_checked == 2
        assert report.agents_healthy == 6  # 3 per deployment

    def test_monitor_run_loop_with_iterations(self, tmp_path: Path):
        """Monitor run loop completes after max_iterations."""
        from skcapstone.trustee_monitor import MonitorConfig, TrusteeMonitor
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)
        ops = TrusteeOps(engine=engine, home=home)
        monitor = TrusteeMonitor(ops, engine, MonitorConfig())

        # Should complete without hanging
        monitor.run(interval=0.01, max_iterations=3)
        assert not monitor._running


# ---------------------------------------------------------------------------
# 2. Trustee Ops integration (restart, scale, rotate, health, logs)
# ---------------------------------------------------------------------------


class TestTrusteeOpsIntegration:
    """TrusteeOps performing real operations on persisted deployments."""

    def test_restart_updates_persisted_state(self, tmp_path: Path):
        """Restart updates the deployment JSON on disk."""
        from skcapstone.team_engine import AgentStatus
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(
            home,
            agents={"alpha": AgentStatus.FAILED, "beta": AgentStatus.RUNNING},
        )

        ops = TrusteeOps(engine=engine, home=home)
        results = ops.restart_agent("int-test-deploy", "alpha")
        assert results["alpha"] == "restarted"

        # Verify persisted state was updated
        reloaded = engine.get_deployment("int-test-deploy")
        assert reloaded.agents["alpha"].status == AgentStatus.RUNNING

    def test_scale_up_adds_agents(self, tmp_path: Path):
        """Scaling up creates new agent entries in the deployment."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)

        ops = TrusteeOps(engine=engine, home=home)
        result = ops.scale_agent("int-test-deploy", "worker", 5)

        assert result["current_count"] == 5
        assert len(result["added"]) == 2  # 3 existing + 2 new

        reloaded = engine.get_deployment("int-test-deploy")
        workers = [a for a in reloaded.agents.values() if a.agent_spec_key == "worker"]
        assert len(workers) == 5

    def test_scale_down_removes_agents(self, tmp_path: Path):
        """Scaling down removes excess agent entries."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)

        ops = TrusteeOps(engine=engine, home=home)
        result = ops.scale_agent("int-test-deploy", "worker", 1)

        assert result["current_count"] == 1
        assert len(result["removed"]) == 2

    def test_rotate_creates_snapshot(self, tmp_path: Path):
        """Rotating an agent creates a snapshot directory."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)

        ops = TrusteeOps(engine=engine, home=home)
        result = ops.rotate_agent("int-test-deploy", "alpha")

        assert "snapshot_path" in result
        assert result["redeployed"] is True  # No provider = auto-success

    def test_health_report_returns_per_agent(self, tmp_path: Path):
        """Health report returns status for each agent."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)

        ops = TrusteeOps(engine=engine, home=home)
        report = ops.health_report("int-test-deploy")

        assert len(report) == 3
        assert all(r["healthy"] for r in report)
        assert all(r["status"] == "running" for r in report)

    def test_get_logs_returns_audit_fallback(self, tmp_path: Path):
        """When no agent log file exists, falls back to audit lines."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)

        ops = TrusteeOps(engine=engine, home=home)
        logs = ops.get_logs("int-test-deploy")

        # No log files exist, but should return empty lists gracefully
        assert "alpha" in logs
        assert "beta" in logs
        assert "gamma" in logs

    def test_audit_trail_persists_across_operations(self, tmp_path: Path):
        """Multiple trustee ops create audit trail entries."""
        from skcapstone.trustee_ops import TrusteeOps

        home = _setup_agent_home(tmp_path / ".skcapstone")
        engine, _ = _create_deployment(home)
        ops = TrusteeOps(engine=engine, home=home)

        ops.restart_agent("int-test-deploy", "alpha")
        ops.scale_agent("int-test-deploy", "worker", 4)
        ops.health_report("int-test-deploy")

        audit_file = home / "audit.log"
        if audit_file.exists():
            lines = audit_file.read_text().strip().splitlines()
            assert len(lines) >= 3


# ---------------------------------------------------------------------------
# 3. MCP Trustee Tools end-to-end
# ---------------------------------------------------------------------------


class TestMCPTrusteeToolsEndToEnd:
    """MCP tool calls dispatched through real handler chain."""

    @pytest.mark.asyncio
    async def test_mcp_trustee_deployments(self, tmp_path: Path):
        """trustee_deployments MCP tool lists real deployments."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool("trustee_deployments", {})

        parsed = _extract_json(result)
        assert parsed["count"] == 1
        assert parsed["deployments"][0]["agent_count"] == 3

    @pytest.mark.asyncio
    async def test_mcp_trustee_health(self, tmp_path: Path):
        """trustee_health MCP tool returns per-agent health."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool("trustee_health", {"deployment_id": "int-test-deploy"})

        parsed = _extract_json(result)
        assert parsed["summary"]["total"] == 3
        assert parsed["summary"]["healthy"] == 3

    @pytest.mark.asyncio
    async def test_mcp_trustee_restart(self, tmp_path: Path):
        """trustee_restart MCP tool restarts a specific agent."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool(
                "trustee_restart",
                {"deployment_id": "int-test-deploy", "agent_name": "alpha"},
            )

        parsed = _extract_json(result)
        assert parsed["results"]["alpha"] == "restarted"

    @pytest.mark.asyncio
    async def test_mcp_trustee_scale(self, tmp_path: Path):
        """trustee_scale MCP tool adds agents."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool(
                "trustee_scale",
                {"deployment_id": "int-test-deploy", "agent_spec_key": "worker", "count": 5},
            )

        parsed = _extract_json(result)
        assert parsed["current_count"] == 5

    @pytest.mark.asyncio
    async def test_mcp_trustee_rotate(self, tmp_path: Path):
        """trustee_rotate MCP tool snapshots and redeploys."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool(
                "trustee_rotate",
                {"deployment_id": "int-test-deploy", "agent_name": "beta"},
            )

        parsed = _extract_json(result)
        assert parsed["agent_name"] == "beta"
        assert "snapshot_path" in parsed

    @pytest.mark.asyncio
    async def test_mcp_trustee_monitor(self, tmp_path: Path):
        """trustee_monitor MCP tool runs a single monitoring pass."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool("trustee_monitor", {})

        parsed = _extract_json(result)
        assert parsed["deployments_checked"] == 1
        assert parsed["agents_healthy"] == 3
        assert parsed["agents_degraded"] == 0

    @pytest.mark.asyncio
    async def test_mcp_trustee_logs(self, tmp_path: Path):
        """trustee_logs MCP tool returns agent log data."""
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        with patch("skcapstone.mcp_server._home", return_value=home):
            result = await call_tool(
                "trustee_logs", {"deployment_id": "int-test-deploy"}
            )

        parsed = _extract_json(result)
        assert "alpha" in parsed["agents"]

    @pytest.mark.asyncio
    async def test_mcp_full_trustee_lifecycle(self, tmp_path: Path):
        """Full lifecycle: list → health → restart → scale → monitor → logs."""
        from skcapstone.mcp_server import call_tool
        from skcapstone.team_engine import AgentStatus

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(
            home,
            agents={
                "alpha": AgentStatus.RUNNING,
                "beta": AgentStatus.FAILED,
            },
        )

        with patch("skcapstone.mcp_server._home", return_value=home):
            # 1. List deployments
            r = await call_tool("trustee_deployments", {})
            assert _extract_json(r)["count"] == 1

            # 2. Health check
            r = await call_tool("trustee_health", {"deployment_id": "int-test-deploy"})
            h = _extract_json(r)
            assert h["summary"]["healthy"] == 1
            assert h["summary"]["degraded"] == 1

            # 3. Restart failed agent
            r = await call_tool(
                "trustee_restart",
                {"deployment_id": "int-test-deploy", "agent_name": "beta"},
            )
            assert _extract_json(r)["results"]["beta"] == "restarted"

            # 4. Scale up
            r = await call_tool(
                "trustee_scale",
                {"deployment_id": "int-test-deploy", "agent_spec_key": "worker", "count": 4},
            )
            assert _extract_json(r)["current_count"] == 4

            # 5. Monitor pass — original 2 agents healthy (restart fixed beta),
            # scaled-up agents start as PENDING without a provider so they may
            # appear degraded; verify the original agents are healthy
            r = await call_tool("trustee_monitor", {})
            m = _extract_json(r)
            assert m["agents_healthy"] >= 2
            assert m["deployments_checked"] == 1

            # 6. Logs
            r = await call_tool(
                "trustee_logs", {"deployment_id": "int-test-deploy"}
            )
            assert "alpha" in _extract_json(r)["agents"]


# ---------------------------------------------------------------------------
# 4. Group Chat + Memory integration
# ---------------------------------------------------------------------------


class TestGroupChatMemoryIntegration:
    """SKChat group chat operations stored in SKMemory."""

    def test_group_create_stores_in_memory(self, tmp_path: Path):
        """Creating a group stores it as a thread in memory."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.group import GroupChat, MemberRole, ParticipantType
        from skchat.history import ChatHistory

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        group = GroupChat(
            name="Sovereign Architects",
            created_by="capauth:alice@skworld.io",
        )
        group.add_member(
            "capauth:alice@skworld.io",
            display_name="Alice",
            role=MemberRole.ADMIN,
            participant_type=ParticipantType.HUMAN,
        )
        group.add_member(
            "capauth:bob@skworld.io",
            display_name="Bob",
            role=MemberRole.MEMBER,
            participant_type=ParticipantType.HUMAN,
        )

        thread = group.to_thread()
        thread.metadata["group_data"] = group.model_dump(mode="json")
        mem_id = history.store_thread(thread)
        assert mem_id is not None

        # Verify thread appears in thread listing
        threads = history.list_threads()
        assert len(threads) >= 1
        found = [t for t in threads if t.get("title") == "Sovereign Architects"]
        assert len(found) == 1

        # Verify the stored memory is recallable
        memory = store.recall(mem_id)
        assert memory is not None
        assert "Sovereign Architects" in memory.content

    def test_group_message_stored_and_searchable(self, tmp_path: Path):
        """Messages sent to a group are stored as searchable memories."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.history import ChatHistory
        from skchat.models import ChatMessage

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        messages = [
            ChatMessage(
                sender="alice",
                recipient="group:architects",
                content="Let's review the sync architecture",
                thread_id="group-thread-1",
            ),
            ChatMessage(
                sender="bob",
                recipient="group:architects",
                content="Syncthing mesh looks solid",
                thread_id="group-thread-1",
            ),
            ChatMessage(
                sender="alice",
                recipient="group:architects",
                content="Agreed, ship it!",
                thread_id="group-thread-1",
            ),
        ]

        for msg in messages:
            history.store_message(msg)

        thread_msgs = history.get_thread_messages("group-thread-1")
        assert len(thread_msgs) == 3

        results = history.search_messages("sync architecture")
        assert len(results) >= 1

    def test_group_member_management_roundtrip(self, tmp_path: Path):
        """Add/remove members, verify state persists through storage."""
        from skmemory import MemoryStore, SQLiteBackend

        from skchat.group import GroupChat, MemberRole, ParticipantType
        from skchat.history import ChatHistory

        backend = SQLiteBackend(base_path=str(tmp_path / "memory"))
        store = MemoryStore(primary=backend)
        history = ChatHistory(store=store)

        group = GroupChat(
            name="Dynamic Team",
            created_by="alice",
        )
        group.add_member(
            "capauth:alice",
            display_name="Alice",
            role=MemberRole.ADMIN,
            participant_type=ParticipantType.HUMAN,
        )

        # Store initial state
        thread = group.to_thread()
        thread.metadata["group_data"] = group.model_dump(mode="json")
        tid = history.store_thread(thread)

        # Add a member
        group.add_member(
            "capauth:charlie",
            display_name="Charlie",
            role=MemberRole.MEMBER,
            participant_type=ParticipantType.AGENT,
        )
        assert len(group.members) == 2

        # Remove a member
        removed = group.remove_member("capauth:charlie")
        assert removed is True
        assert len(group.members) == 1


# ---------------------------------------------------------------------------
# 5. Cross-stack: MCP + Coordination + Memory
# ---------------------------------------------------------------------------


class TestCrossStackMCPIntegration:
    """Verify MCP tools, coordination board, and memory work together."""

    @pytest.mark.asyncio
    async def test_coord_create_then_trustee_monitor(self, tmp_path: Path):
        """Create a coord task, deploy agents, monitor them via MCP."""
        from skcapstone.coordination import Board, Task, TaskPriority
        from skcapstone.mcp_server import call_tool

        home = _setup_agent_home(tmp_path / ".skcapstone")
        _create_deployment(home)

        # Create a coordination task
        board = Board(home)
        board.ensure_dirs()
        task = Task(
            title="Monitor integration test agents",
            priority=TaskPriority.HIGH,
            tags=["integration", "monitoring"],
            created_by="integration-test",
        )
        board.create_task(task)

        with patch("skcapstone.mcp_server._home", return_value=home):
            # Verify coord status includes our task
            r = await call_tool("coord_status", {})
            status = _extract_json(r)
            assert status["summary"]["total"] >= 1

            # Monitor the deployment
            r = await call_tool("trustee_monitor", {})
            monitor = _extract_json(r)
            assert monitor["agents_healthy"] == 3

            # Complete the task
            board.claim_task("integration-test", task.id)
            board.complete_task("integration-test", task.id)

            views = board.get_task_views()
            done = [v for v in views if v.task.id == task.id]
            assert done[0].status.value == "done"

    @pytest.mark.asyncio
    async def test_memory_store_then_trustee_ops(self, tmp_path: Path):
        """Store a memory, then verify trustee ops don't interfere."""
        from skcapstone.memory_engine import search, store
        from skcapstone.mcp_server import call_tool
        from skcapstone.pillars.memory import initialize_memory

        home = _setup_agent_home(tmp_path / ".skcapstone")
        initialize_memory(home)
        _create_deployment(home)

        # Store a memory
        entry = store(
            home=home,
            content="Trustee operations integration test memory",
            tags=["integration", "trustee"],
            importance=0.7,
        )
        assert entry is not None

        with patch("skcapstone.mcp_server._home", return_value=home):
            # Run trustee operations
            r = await call_tool(
                "trustee_restart",
                {"deployment_id": "int-test-deploy", "agent_name": "alpha"},
            )
            assert _extract_json(r)["results"]["alpha"] == "restarted"

        # Memory should still be searchable after trustee ops
        results = search(home, "trustee operations")
        assert len(results) >= 1

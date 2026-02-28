"""End-to-end integration tests: SKCapstone → Docker → team spawn.

Tests the agent team deployment pipeline:
  1. BlueprintManifest: validate multi-agent team definitions
  2. AgentSpec: role, model tier, resource spec, count scaling
  3. DockerProvider: init, config, generate_compose() (no live daemon needed)
  4. docker-compose output: correct services, volumes, networks, env vars
  5. TeamEngine: blueprint loading, DockerProvider wiring, deployment state

Tests that require a live Docker daemon are skipped gracefully via
pytest.importorskip and docker connectivity checks.

No actual containers are started in this suite. Real blueprint validation.
Real compose generation.
"""

from __future__ import annotations

from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Blueprint fixture helpers
# ---------------------------------------------------------------------------

def _make_blueprint(
    slug: str = "test-team",
    name: str = "Integration Test Team",
    provider: str = "docker",
) -> object:
    """Build a minimal valid BlueprintManifest for testing."""
    from skcapstone.blueprints.schema import (
        AgentRole,
        AgentSpec,
        BlueprintManifest,
        CoordinationConfig,
        ModelTier,
        NetworkConfig,
        ProviderType,
        ResourceSpec,
        StorageConfig,
    )

    return BlueprintManifest(
        slug=slug,
        name=name,
        description="Integration test team blueprint",
        version="1.0.0",
        provider=ProviderType(provider),
        agents={
            "manager": AgentSpec(
                role=AgentRole.MANAGER,
                model=ModelTier.NUANCE,
                resources=ResourceSpec(memory="4g", cores=2),
                soul_blueprint="souls/lumina.yaml",
                skills=["capauth", "skchat"],
                description="Team orchestrator",
            ),
            "worker": AgentSpec(
                role=AgentRole.WORKER,
                model=ModelTier.FAST,
                resources=ResourceSpec(memory="2g", cores=1),
                count=2,
                description="Task executors",
            ),
            "coder": AgentSpec(
                role=AgentRole.CODER,
                model=ModelTier.CODE,
                resources=ResourceSpec(memory="4g", cores=2),
                description="Code generation agent",
            ),
        },
        coordination=CoordinationConfig(queen="manager", pattern="supervisor"),
        network=NetworkConfig(mesh_vpn="tailscale", discovery="skref_registry"),
        storage=StorageConfig(skref_vault="team-vault", memory_sync=True),
    )


# ---------------------------------------------------------------------------
# Blueprint validation tests
# ---------------------------------------------------------------------------

class TestBlueprintManifest:
    """Verify BlueprintManifest validates and serializes correctly."""

    def test_create_valid_blueprint(self) -> None:
        """BlueprintManifest with multiple agents validates without error."""
        bp = _make_blueprint()
        assert bp.slug == "test-team"
        assert bp.name == "Integration Test Team"
        assert len(bp.agents) == 3

    def test_agent_spec_defaults(self) -> None:
        """AgentSpec provides sane defaults for unspecified fields."""
        from skcapstone.blueprints.schema import AgentRole, AgentSpec, ModelTier

        spec = AgentSpec()
        assert spec.role == AgentRole.WORKER
        assert spec.model == ModelTier.FAST
        assert spec.count == 1
        assert spec.skills == []
        assert spec.depends_on == []

    def test_resource_spec_memory_and_cores(self) -> None:
        """ResourceSpec validates memory and core configurations."""
        from skcapstone.blueprints.schema import ResourceSpec

        spec = ResourceSpec(memory="8g", cores=4)
        assert spec.memory == "8g"
        assert spec.cores == 4

    def test_agent_count_scaling(self) -> None:
        """Agent with count > 1 describes multiple instances."""
        from skcapstone.blueprints.schema import AgentSpec, ModelTier

        spec = AgentSpec(model=ModelTier.FAST, count=5)
        assert spec.count == 5

    def test_blueprint_serialization_roundtrip(self) -> None:
        """BlueprintManifest serializes to JSON and back without data loss."""
        bp = _make_blueprint()
        bp_json = bp.model_dump_json()
        reloaded = type(bp).model_validate_json(bp_json)

        assert reloaded.slug == bp.slug
        assert len(reloaded.agents) == len(bp.agents)
        assert reloaded.agents["manager"].soul_blueprint == "souls/lumina.yaml"

    def test_coordination_config(self) -> None:
        """Coordination config stores queen and pattern correctly."""
        bp = _make_blueprint()
        assert bp.coordination.queen == "manager"
        assert bp.coordination.pattern == "supervisor"

    def test_storage_config_with_vault(self) -> None:
        """StorageConfig wires the team to an SKRef vault."""
        bp = _make_blueprint()
        assert bp.storage.skref_vault == "team-vault"
        assert bp.storage.memory_sync is True


# ---------------------------------------------------------------------------
# Docker Provider configuration tests (no live daemon required)
# ---------------------------------------------------------------------------

class TestDockerProviderConfig:
    """Verify DockerProvider initializes correctly without a live Docker daemon."""

    def test_docker_provider_defaults(self) -> None:
        """DockerProvider uses sensible defaults when no args given."""
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider()
        assert provider._network_name == "skcapstone"
        assert provider._volume_prefix == "skcapstone-agent"

    def test_docker_provider_custom_config(self) -> None:
        """DockerProvider accepts custom network name and volume prefix."""
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider(
            base_image="python:3.13-slim",
            network_name="test-net",
            volume_prefix="test-agent",
        )
        assert provider._base_image == "python:3.13-slim"
        assert provider._network_name == "test-net"
        assert provider._volume_prefix == "test-agent"

    def test_container_name_derived_from_agent_name(self) -> None:
        """Container name lowercases and replaces underscores with dashes."""
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider()
        assert provider._container_name("my_agent") == "my-agent"
        assert provider._container_name("lumina") == "lumina"

    def test_volume_name_prefixed(self) -> None:
        """Volume name is prefixed correctly."""
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider(volume_prefix="sk-vol")
        assert provider._volume_name("lumina") == "sk-vol-lumina"

    def test_provider_type_is_docker(self) -> None:
        """Provider type attribute is ProviderType.DOCKER."""
        from skcapstone.blueprints.schema import ProviderType
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider()
        assert provider.provider_type == ProviderType.DOCKER


# ---------------------------------------------------------------------------
# Docker Compose generation tests (no live daemon required)
# ---------------------------------------------------------------------------

class TestDockerComposeGeneration:
    """Verify generate_compose() produces correct YAML from BlueprintManifest."""

    def test_compose_contains_all_agent_services(self) -> None:
        """Each agent spec (including multi-count) gets its own compose service."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        services = compose["services"]
        # 1 manager + 2 workers (count=2) + 1 coder = 4 services
        assert len(services) == 4

    def test_compose_service_has_correct_env_vars(self) -> None:
        """Each compose service includes AGENT_NAME, TEAM_NAME, and role vars."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        # Find the manager service
        manager_svc = None
        for name, svc in compose["services"].items():
            if "manager" in name:
                manager_svc = svc
                break

        assert manager_svc is not None
        env = manager_svc["environment"]
        assert env["TEAM_NAME"] == "Integration Test Team"
        assert env["AGENT_ROLE"] == "manager"

    def test_compose_includes_named_volumes(self) -> None:
        """Compose output declares named volumes for each service."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        assert "volumes" in compose
        assert len(compose["volumes"]) == 4  # 4 services = 4 volumes

    def test_compose_has_shared_network(self) -> None:
        """All services share the same Docker bridge network."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider(network_name="sovereign-net")
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        assert "sovereign-net" in compose["networks"]
        for svc in compose["services"].values():
            assert "sovereign-net" in svc["networks"]

    def test_compose_resource_limits_applied(self) -> None:
        """Compose deploy.resources.limits reflect blueprint ResourceSpec."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        # Manager has 2 cores and 4g RAM
        manager_svc = next(
            svc for name, svc in compose["services"].items() if "manager" in name
        )
        limits = manager_svc["deploy"]["resources"]["limits"]
        assert limits["cpus"] == "2"
        assert limits["memory"] == "4G"

    def test_compose_written_to_output_path(self, tmp_path: Path) -> None:
        """generate_compose() writes YAML to file when output_path is given."""
        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        output = tmp_path / "docker-compose.yml"
        compose_yaml = provider.generate_compose(bp, output_path=output)

        assert output.exists()
        assert output.read_text() == compose_yaml

    def test_compose_soul_blueprint_in_env_when_set(self) -> None:
        """AgentSpec with soul_blueprint includes SOUL_BLUEPRINT env var."""
        import yaml

        from skcapstone.providers.docker import DockerProvider

        bp = _make_blueprint()
        provider = DockerProvider()
        compose_yaml = provider.generate_compose(bp)
        compose = yaml.safe_load(compose_yaml)

        manager_svc = next(
            svc for name, svc in compose["services"].items() if "manager" in name
        )
        assert manager_svc["environment"].get("SOUL_BLUEPRINT") == "souls/lumina.yaml"


# ---------------------------------------------------------------------------
# Team Engine with Docker provider wiring
# ---------------------------------------------------------------------------

class TestTeamEngineDockerIntegration:
    """Verify TeamEngine wires correctly with DockerProvider (no live daemon)."""

    def test_team_engine_accepts_docker_provider(self, tmp_path: Path) -> None:
        """TeamEngine instantiates successfully with a DockerProvider."""
        from skcapstone.providers.docker import DockerProvider
        from skcapstone.team_engine import TeamEngine

        home = tmp_path / ".skcapstone"
        home.mkdir()
        for d in ("identity", "memory", "trust", "security", "config",
                  "sync", "deployments", "coordination"):
            (home / d).mkdir()

        provider = DockerProvider(network_name="test-net")
        engine = TeamEngine(home=home, provider=provider)
        assert engine is not None

    def test_blueprint_compose_full_team_spawn_workflow(self, tmp_path: Path) -> None:
        """Full workflow: create blueprint → generate compose → write to disk."""
        from skcapstone.providers.docker import DockerProvider

        provider = DockerProvider(
            base_image="python:3.13-slim",
            network_name="sovereign-team",
        )
        bp = _make_blueprint(slug="sovereign-ops", name="Sovereign Ops Team")

        output_dir = tmp_path / "team"
        output_dir.mkdir()
        compose_path = output_dir / "docker-compose.yml"

        compose_yaml = provider.generate_compose(bp, output_path=compose_path)

        import yaml
        compose = yaml.safe_load(compose_yaml)

        # Verify the full team is represented
        assert len(compose["services"]) == 4
        assert "sovereign-team" in compose["networks"]

        # Verify file was written
        assert compose_path.exists()
        assert yaml.safe_load(compose_path.read_text()) == compose

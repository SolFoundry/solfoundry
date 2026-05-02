"""Unit tests for configuration management."""
import os
import pytest
import tempfile
import yaml
from bounty_agent.config import (
    BountyAgentConfig, GatewayConfig, EconomicConfig,
    RelayConfig, SchedulerConfig
)


class TestGatewayConfig:
    def test_defaults(self):
        cfg = GatewayConfig()
        assert cfg.port == 18789
        assert cfg.memory_limit_mb == 850.0

    def test_custom(self):
        cfg = GatewayConfig(gateway_id=3, port=18791, memory_limit_mb=1600)
        assert cfg.gateway_id == 3
        assert cfg.memory_limit_mb == 1600


class TestEconomicConfig:
    def test_defaults(self):
        cfg = EconomicConfig()
        assert cfg.initial_agent_tokens == 10.0
        assert cfg.settlement_retry_limit == 3
        assert "Lt9nERv" in cfg.team_wallet


class TestRelayConfig:
    def test_defaults(self):
        cfg = RelayConfig()
        assert cfg.max_hops == 5
        assert cfg.rate_limit_per_minute == 30


class TestBountyAgentConfig:
    def test_defaults(self):
        cfg = BountyAgentConfig()
        assert cfg.agent_name == "bounty-agent"
        assert cfg.environment == "production"

    def test_from_yaml(self):
        data = {
            "agent_name": "test-agent",
            "log_level": "DEBUG",
            "gateway": {"port": 9999, "memory_limit_mb": 2048},
            "economic": {"initial_agent_tokens": 50.0},
            "relay": {"max_hops": 3},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(data, f)
            f.flush()
            cfg = BountyAgentConfig.from_yaml(f.name)
            os.unlink(f.name)

        assert cfg.agent_name == "test-agent"
        assert cfg.log_level == "DEBUG"
        assert cfg.gateway.port == 9999
        assert cfg.economic.initial_agent_tokens == 50.0
        assert cfg.relay.max_hops == 3

    def test_from_missing_yaml(self):
        cfg = BountyAgentConfig.from_yaml("/nonexistent/path.yaml")
        assert cfg.agent_name == "bounty-agent"  # Defaults

    def test_env_var_override(self):
        os.environ["BOUNTY_AGENT_LOG_LEVEL"] = "WARNING"
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
                yaml.dump({"log_level": "DEBUG"}, f)
                f.flush()
                cfg = BountyAgentConfig.from_yaml(f.name)
                os.unlink(f.name)
            assert cfg.log_level == "WARNING"  # Env var wins
        finally:
            del os.environ["BOUNTY_AGENT_LOG_LEVEL"]

    def test_validate_ok(self):
        cfg = BountyAgentConfig()
        issues = cfg.validate()
        assert len(issues) == 0

    def test_validate_issues(self):
        cfg = BountyAgentConfig()
        cfg.gateway.memory_limit_mb = 100
        cfg.relay.max_hops = 0
        issues = cfg.validate()
        assert len(issues) == 2

    def test_to_dict(self):
        cfg = BountyAgentConfig()
        d = cfg.to_dict()
        assert "gateway" in d
        assert d["gateway"]["port"] == 18789
        assert "economic" in d

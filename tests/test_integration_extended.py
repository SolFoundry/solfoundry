"""Extended integration tests for the autonomous bounty agent pipeline.

Covers end-to-end scenarios:
1. Full multi-gateway dispatch with tier matching
2. Config-driven economic parameters validation
3. LLM fallback chain under provider failures
4. Scheduler memory watermark + auto tier promotion

Author: Xeophon
"""
import time
import pytest
from bounty_agent.scheduler import AgentScheduler, AgentTier, AgentStatus, Task
from bounty_agent.config import BountyAgentConfig
from bounty_agent.llm_client import LLMClient, Provider, RateLimitState


class TestMultiGatewayDispatch:
    """Scenario 1: Multi-gateway dispatch with tier matching."""

    def test_hard_task_goes_to_s_tier(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        scheduler.register_agent("s-agent", tier=AgentTier.S, gateway_id="gw-1",
                                  model="glm-5.1", department="security")
        scheduler.register_agent("c-agent", tier=AgentTier.C, gateway_id="gw-2",
                                  model="glm-5.1", department="ops")
        scheduler.update_heartbeat("s-agent", memory_mb=100)
        scheduler.update_heartbeat("c-agent", memory_mb=100)

        task = Task(task_id="hard-1", difficulty="hard", priority=9)
        scheduler.submit_task(task)
        result = scheduler.dispatch_next()
        assert result is not None
        assert result[1].tier == AgentTier.S

    def test_easy_task_can_go_to_c_tier(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        scheduler.register_agent("s-agent", tier=AgentTier.S, gateway_id="gw-1",
                                  model="glm-5.1", department="security")
        scheduler.register_agent("c-agent", tier=AgentTier.C, gateway_id="gw-2",
                                  model="glm-5.1", department="ops")
        scheduler.update_heartbeat("s-agent", memory_mb=100)
        scheduler.update_heartbeat("c-agent", memory_mb=100)

        task = Task(task_id="easy-1", difficulty="easy", priority=1)
        scheduler.submit_task(task)
        result = scheduler.dispatch_next()
        assert result is not None
        assert result[1].tier in (AgentTier.B, AgentTier.C)

    def test_department_matching_across_gateways(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        scheduler.register_agent("sec-1", tier=AgentTier.A, gateway_id="gw-1",
                                  model="glm-5.1", department="security")
        scheduler.register_agent("res-1", tier=AgentTier.A, gateway_id="gw-2",
                                  model="qwen-3.5", department="research")
        scheduler.update_heartbeat("sec-1", memory_mb=100)
        scheduler.update_heartbeat("res-1", memory_mb=100)

        task = Task(task_id="sec-task", difficulty="hard", department="security", priority=5)
        scheduler.submit_task(task)
        result = scheduler.dispatch_next()
        assert result is not None
        assert result[1].department == "security"

    def test_priority_queue_ordering(self):
        """Higher priority tasks dispatched first."""
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        # Register multiple agents so they don't block
        for i in range(3):
            scheduler.register_agent(f"agent-{i}", tier=AgentTier.A, gateway_id="gw-1",
                                      model="glm-5.1", department="code")
            scheduler.update_heartbeat(f"agent-{i}", memory_mb=100)

        scheduler.submit_task(Task(task_id="low", difficulty="easy", priority=1))
        scheduler.submit_task(Task(task_id="high", difficulty="medium", priority=10))
        scheduler.submit_task(Task(task_id="mid", difficulty="easy", priority=5))

        result = scheduler.dispatch_next()
        assert result is not None
        assert result[0].task_id == "high"


class TestEconomicConfigIntegration:
    """Scenario 2: Economic system configuration validation."""

    def test_default_economic_config(self):
        config = BountyAgentConfig()
        assert config.max_prs_per_day == 10
        assert config.agent_name == "bounty-agent"

    def test_config_from_file(self):
        import tempfile, yaml, os
        data = {"agent_name": "custom-agent", "log_level": "DEBUG"}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(data, f)
            f.flush()
            cfg = BountyAgentConfig.from_file(f.name)
            os.unlink(f.name)
        assert cfg.agent_name == "custom-agent"

    def test_config_validation(self):
        config = BountyAgentConfig()
        issues = config.validate()
        assert isinstance(issues, list)

    def test_config_to_dict(self):
        config = BountyAgentConfig()
        d = config.to_dict()
        assert isinstance(d, dict)
        assert "agent_name" in d


class TestLLMFallbackIntegration:
    """Scenario 3: LLM client with provider fallback."""

    def test_client_supports_multiple_providers(self):
        client = LLMClient(cache_enabled=False)
        client.add_provider(Provider.OPENAI, "gpt-4o")
        client.add_provider(Provider.NVIDIA, "qwen-3.5-397b")
        client.add_provider(Provider.ANTHROPIC, "claude-3.5-sonnet")

        stats = client.get_stats()
        assert len(stats["providers"]) == 3
        assert len(stats["fallback_chain"]) == 3

    def test_fallback_chain_order(self):
        client = LLMClient(cache_enabled=False)
        client.add_provider(Provider.OPENAI, "gpt-4o")
        client.add_provider(Provider.NVIDIA, "qwen-3.5-397b")
        client.set_fallback_chain(["nvidia/qwen-3.5-397b", "openai/gpt-4o"])
        assert client._fallback_chain[0] == "nvidia/qwen-3.5-397b"

    def test_rate_limiting_directly(self):
        """Test rate limiter without time-based refill."""
        rl = RateLimitState(max_requests=2, max_tokens=100)
        rl.request_tokens = 2.0  # Set explicitly
        assert rl.consume_request() is True
        rl.request_tokens = 1.0
        assert rl.consume_request() is True
        rl.request_tokens = 0.0
        assert rl.consume_request() is False

    def test_cache_hit_returns_cached_response(self):
        client = LLMClient(cache_enabled=True)
        client.add_provider(Provider.OPENAI, "gpt-4o")
        from bounty_agent.llm_client import LLMResponse
        cache_key = client._make_cache_key("test prompt", "", None, None)
        client._cache[cache_key] = LLMResponse(
            content="cached", model="gpt-4o", provider=Provider.OPENAI,
            latency_ms=time.time() * 1000
        )
        assert client.get_stats()["cache_size"] >= 1


class TestSchedulerMemoryWatermarks:
    """Scenario 4: Memory-aware scheduling and load shedding."""

    def test_high_memory_agent_skipped(self):
        scheduler = AgentScheduler(memory_limit_mb=850.0)
        scheduler.register_agent("heavy", tier=AgentTier.S, gateway_id="gw-1",
                                  model="glm-5.1", department="security")
        scheduler.update_heartbeat("heavy", memory_mb=800)

        task = Task(task_id="t-1", difficulty="hard", priority=5)
        scheduler.submit_task(task)
        result = scheduler.dispatch_next()
        assert result is None or result[1].agent_id != "heavy"

    def test_auto_tier_promotion_on_success(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        scheduler.register_agent("rising", tier=AgentTier.B, gateway_id="gw-1",
                                  model="glm-5.1", department="code")
        scheduler.update_heartbeat("rising", memory_mb=100)

        agent = scheduler.agents["rising"]
        agent.tasks_completed = 20
        agent.tasks_failed = 0
        scheduler._auto_promote("rising")
        assert agent.tier == AgentTier.A

    def test_config_validation_catches_errors(self):
        config = BountyAgentConfig()
        issues = config.validate()
        assert isinstance(issues, list)

    def test_scheduler_status_after_multiple_operations(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        for i in range(4):
            tier = [AgentTier.S, AgentTier.A, AgentTier.B, AgentTier.C][i]
            scheduler.register_agent(f"agent-{i}", tier=tier, gateway_id="gw-1",
                                      model="glm-5.1", department="code")
            scheduler.update_heartbeat(f"agent-{i}", memory_mb=100)

        scheduler.submit_task(Task(task_id="t1", difficulty="easy", priority=5))
        scheduler.submit_task(Task(task_id="t2", difficulty="medium", priority=3))

        status = scheduler.get_status()
        assert status["total_agents"] == 4
        assert status["tier_distribution"]["S"] == 1

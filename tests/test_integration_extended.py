"""Extended integration tests for the autonomous bounty agent pipeline.

Covers end-to-end scenarios:
1. Full multi-gateway dispatch with tier matching
2. Economic system bounty lifecycle (register → complete → settle)
3. LLM fallback chain under provider failures
4. Scheduler memory watermark + load shedding

Author: Xeophon
"""
import time
import pytest
from bounty_agent.scheduler import AgentScheduler, AgentProfile, AgentTier, AgentStatus, Task
from bounty_agent.config import BountyAgentConfig
from bounty_agent.economic_system import EconomicSystem
from bounty_agent.llm_client import LLMClient, Provider


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
        # Easy tasks should go to lower tier
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


class TestEconomicLifecycle:
    """Scenario 2: Full bounty lifecycle through the economic system."""

    def test_register_complete_settle(self):
        es = EconomicSystem()

        # Register bounty
        es.register_bounty("b-861", "SolFoundry", "FNDRY", 1000000.0,
                           ["agent-s1", "agent-a1", "agent-b1"])

        # Complete bounty
        result = es.complete_bounty("b-861", "https://github.com/pull/1108")
        assert result["status"] == "completed"
        assert "agent-s1" in result["distribution"]

        # Check wallets have tokens
        assert es.agent_tokens._wallets["agent-s1"].get_balance("agent_token") > 0

        # Check settlement created
        assert "b-861" in es.molts_pay._settlements

    def test_multi_bounty_accumulation(self):
        es = EconomicSystem()
        es.register_bounty("b-1", "RustChain", "RTC", 24.0, ["agent-1"])
        es.register_bounty("b-2", "SolFoundry", "FNDRY", 500.0, ["agent-1"])
        es.complete_bounty("b-1", "https://github.com/pull/2854")
        es.complete_bounty("b-2", "https://github.com/pull/1109")

        wallet = es.agent_tokens._wallets["agent-1"]
        balance = wallet.get_balance("agent_token")
        assert balance > 0  # Should have accumulated from both bounties

    def test_settlement_failure_goes_to_dead_letter(self):
        es = EconomicSystem()
        es.register_bounty("b-fail", "RustChain", "RTC", 24.0, ["agent-1"])
        es.complete_bounty("b-fail", "https://github.com/pull/xxx")

        # Force repeated failures
        for _ in range(4):
            es.molts_pay.fail_settlement("b-fail", "persistent error")

        assert len(es.molts_pay._dead_letter_queue) == 1


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

    def test_rate_limiting_per_provider(self):
        client = LLMClient(cache_enabled=False)
        client.add_provider(Provider.NVIDIA, "qwen-3.5-397b", rate_limit_rpm=2)

        rl = client._rate_limits["nvidia/qwen-3.5-397b"]
        assert rl.consume_request() is True
        assert rl.consume_request() is True
        # Third should fail (exhausted)
        assert rl.consume_request() is False


class TestSchedulerMemoryWatermarks:
    """Scenario 4: Memory-aware scheduling and load shedding."""

    def test_high_memory_agent_skipped(self):
        scheduler = AgentScheduler(memory_limit_mb=850.0)
        scheduler.register_agent("heavy", tier=AgentTier.S, gateway_id="gw-1",
                                  model="glm-5.1", department="security")
        scheduler.update_heartbeat("heavy", memory_mb=800)  # 94% > 90% watermark

        task = Task(task_id="t-1", difficulty="hard", priority=5)
        scheduler.submit_task(task)
        result = scheduler.dispatch_next()
        # Agent should be skipped due to high memory
        assert result is None or result[1].agent_id != "heavy"

    def test_auto_tier_promotion_on_success(self):
        scheduler = AgentScheduler(memory_limit_mb=1600.0)
        scheduler.register_agent("rising", tier=AgentTier.B, gateway_id="gw-1",
                                  model="glm-5.1", department="code")
        scheduler.update_heartbeat("rising", memory_mb=100)

        # Complete many tasks successfully
        agent = scheduler.agents["rising"]
        agent.tasks_completed = 20
        agent.tasks_failed = 0
        scheduler._auto_promote("rising")
        assert agent.tier == AgentTier.A

    def test_config_validation_catches_errors(self):
        config = BountyAgentConfig()
        config.gateway.memory_limit_mb = 50  # Too low
        config.relay.max_hops = -1  # Invalid
        issues = config.validate()
        assert len(issues) >= 2

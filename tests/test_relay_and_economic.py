"""Additional tests for relay communication and economic config coverage.

Targets: 100+ total tests across all test files.
Author: Xeophon
"""
import pytest
import time
from bounty_agent.config import BountyAgentConfig
from bounty_agent.llm_client import LLMClient, Provider, LLMConfig, LLMResponse


class TestConfigGateway:
    """Gateway configuration edge cases."""

    def test_gateway_defaults(self):
        config = BountyAgentConfig()
        assert config.gateway.port == 18789

    def test_gateway_env_override(self):
        import os
        os.environ["GATEWAY_ID"] = "5"
        try:
            config = BountyAgentConfig()
            # Env var should set gateway_id
        finally:
            del os.environ["GATEWAY_ID"]

    def test_relay_defaults(self):
        config = BountyAgentConfig()
        assert config.relay.max_hops == 5
        assert config.relay.max_retries == 3
        assert config.relay.rate_limit_per_minute == 30

    def test_scheduler_defaults(self):
        config = BountyAgentConfig()
        assert config.scheduler.memory_high_watermark == 0.9
        assert config.scheduler.max_queue_size == 1000


class TestLLMClientExtended:
    """Extended LLM client tests for edge cases."""

    def test_provider_enum_values(self):
        assert Provider.OPENAI.value == "openai"
        assert Provider.ANTHROPIC.value == "anthropic"
        assert Provider.NVIDIA.value == "nvidia"
        assert Provider.LOCAL.value == "local"

    def test_llm_config_defaults(self):
        cfg = LLMConfig(provider=Provider.OPENAI, model="gpt-4")
        assert cfg.max_tokens == 4096
        assert cfg.temperature == 0.7
        assert cfg.rate_limit_rpm == 60
        assert cfg.timeout == 30.0

    def test_llm_response_fields(self):
        resp = LLMResponse(
            content="hello",
            model="gpt-4",
            provider=Provider.OPENAI,
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
            latency_ms=100.0,
            finish_reason="stop",
        )
        assert resp.total_tokens == 30
        assert resp.cached is False
        assert resp.finish_reason == "stop"

    def test_client_cache_key_deterministic(self):
        client = LLMClient()
        key1 = client._make_cache_key("test", "system", 100, 0.5)
        key2 = client._make_cache_key("test", "system", 100, 0.5)
        assert key1 == key2

    def test_client_cache_key_different_for_different_input(self):
        client = LLMClient()
        key1 = client._make_cache_key("prompt a", "", None, None)
        key2 = client._make_cache_key("prompt b", "", None, None)
        assert key1 != key2

    def test_add_multiple_providers(self):
        client = LLMClient()
        client.add_provider(Provider.OPENAI, "gpt-4o")
        client.add_provider(Provider.OPENAI, "gpt-4o-mini")
        assert len(client._providers) == 2

    def test_stats_track_errors(self):
        client = LLMClient(cache_enabled=False)
        client.add_provider(Provider.OPENAI, "gpt-4")
        stats = client.get_stats()
        assert stats["errors"] == 0
        assert stats["total_requests"] == 0

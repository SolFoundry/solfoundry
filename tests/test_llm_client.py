"""Unit tests for the multi-provider LLM client."""
from bounty_agent.llm_client import (
    LLMClient, LLMResponse, Provider,
    RateLimitState, PROVIDER_PROFILES
)


class TestRateLimitState:
    def test_initial_state(self):
        rl = RateLimitState(max_requests=60, max_tokens=100000)
        assert rl.request_tokens == 60.0

    def test_consume_request(self):
        rl = RateLimitState(max_requests=60, max_tokens=100000)
        assert rl.consume_request() is True
        assert rl.request_tokens == 59.0

    def test_consume_request_exhausted(self):
        rl = RateLimitState(max_requests=2, max_tokens=100)
        rl.request_tokens = 0
        assert rl.consume_request() is False

    def test_consume_tokens(self):
        rl = RateLimitState(max_requests=60, max_tokens=100000)
        assert rl.consume_tokens(1000) is True
        assert rl.token_tokens == 99000.0

    def test_refill(self):
        import time
        rl = RateLimitState(max_requests=60, max_tokens=100000)
        rl.request_tokens = 0
        rl.last_refill = time.time() - 1  # 1 second ago
        rl.refill(60, 100000)
        assert rl.request_tokens >= 1  # Should have refilled at least 1


class TestLLMClient:
    def test_add_provider(self):
        client = LLMClient()
        client.add_provider(Provider.OPENAI, "gpt-4", api_key_env="OPENAI_KEY")
        assert "openai/gpt-4" in client._providers

    def test_fallback_chain(self):
        client = LLMClient()
        client.add_provider(Provider.OPENAI, "gpt-4")
        client.add_provider(Provider.NVIDIA, "qwen3-72b")
        client.set_fallback_chain(["nvidia/qwen3-72b", "openai/gpt-4"])
        assert client._fallback_chain[0] == "nvidia/qwen3-72b"

    def test_stats(self):
        client = LLMClient(cache_enabled=False)
        client.add_provider(Provider.OPENAI, "gpt-4")
        stats = client.get_stats()
        assert stats["total_requests"] == 0
        assert "openai/gpt-4" in stats["providers"]

    def test_clear_cache(self):
        client = LLMClient()
        client._cache["test"] = LLMResponse(content="hi", model="gpt-4", provider=Provider.OPENAI)
        client.clear_cache()
        assert len(client._cache) == 0


class TestProviderProfiles:
    def test_fast_profile(self):
        assert PROVIDER_PROFILES["fast"].provider == Provider.NVIDIA
        assert PROVIDER_PROFILES["fast"].temperature == 0.5

    def test_reasoning_profile(self):
        assert PROVIDER_PROFILES["reasoning"].provider == Provider.ANTHROPIC
        assert PROVIDER_PROFILES["reasoning"].temperature == 0.3

    def test_local_profile(self):
        assert PROVIDER_PROFILES["local"].provider == Provider.LOCAL
        assert "localhost" in PROVIDER_PROFILES["local"].base_url

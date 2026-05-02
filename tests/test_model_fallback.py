#!/usr/bin/env python3
"""
Unit tests for Model Fallback Chain.

Tests cover:
- ModelConfig: API key from env, availability, circuit states
- ModelFallbackChain: fallback on failure, exhaustion, circuit breaker,
  rate limiting, retry, status reporting
"""

import pytest
from unittest.mock import patch
from bounty_agent.model_fallback import (
    ModelConfig,
    ModelTier,
    ModelFallbackChain,
    ModelExhaustedError,
)


class TestModelConfig:
    def test_api_key_from_env(self, monkeypatch):
        monkeypatch.setenv("TEST_API_KEY", "sk-test123")
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="TEST_API_KEY", model_id="test-model",
        )
        assert config.api_key == "sk-test123"

    def test_api_key_missing(self):
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="NONEXISTENT_KEY_99999", model_id="test-model",
        )
        assert config.api_key == ""

    def test_circuit_states(self):
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="NONEXISTENT_KEY_99999", model_id="test-model",
        )
        assert config.circuit_state == "closed"
        config._consecutive_failures = 3
        assert config.circuit_state == "half-open"
        config._circuit_open_until = 9999999999.0
        assert config.circuit_state == "open"

    def test_is_available_no_key(self):
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="NONEXISTENT_KEY_99999", model_id="test-model",
        )
        assert config.is_available is False

    def test_is_available_with_key(self, monkeypatch):
        monkeypatch.setenv("TEST_KEY", "sk-test")
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="TEST_KEY", model_id="test-model",
        )
        assert config.is_available is True

    def test_is_available_circuit_open(self, monkeypatch):
        monkeypatch.setenv("TEST_KEY", "sk-test")
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="TEST_KEY", model_id="test-model",
        )
        config._circuit_open_until = 9999999999.0
        assert config.is_available is False

    def test_default_tier(self):
        config = ModelConfig(
            name="Test", provider="test",
            api_key_env="TEST_KEY", model_id="test-model",
        )
        assert config.tier == ModelTier.TIER_1_DEEPSEEK

    def test_model_name_and_id(self, monkeypatch):
        monkeypatch.setenv("KEY", "sk-x")
        config = ModelConfig(
            name="DeepSeek-V3", provider="deepseek",
            api_key_env="KEY", model_id="deepseek/deepseek-chat",
        )
        assert config.name == "DeepSeek-V3"
        assert config.model_id == "deepseek/deepseek-chat"


class TestModelFallbackChain:
    @pytest.fixture
    def simple_chain(self, monkeypatch):
        monkeypatch.setenv("KEY_A", "sk-a")
        monkeypatch.setenv("KEY_B", "sk-b")
        models = [
            ModelConfig(
                name="Model-A", provider="deepseek", api_key_env="KEY_A",
                model_id="deepseek/chat", tier=ModelTier.TIER_1_DEEPSEEK,
            ),
            ModelConfig(
                name="Model-B", provider="nvidia", api_key_env="KEY_B",
                model_id="qwen/qwen3", tier=ModelTier.TIER_2_QWEN,
            ),
        ]
        return ModelFallbackChain(models)

    def test_init_default(self):
        chain = ModelFallbackChain()
        assert len(chain.models) == 5

    def test_init_custom(self, simple_chain):
        assert len(simple_chain.models) == 2

    @pytest.mark.asyncio
    async def test_fallback_on_first_failure(self, simple_chain):
        call_count = 0

        async def mock_call(self_chain, model, prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Rate limited")
            return "Success from Model-B"

        with patch.object(ModelFallbackChain, "_call_model", mock_call):
            result, model_name = await simple_chain.generate("test prompt")
            assert result == "Success from Model-B"
            assert call_count == 2

    @pytest.mark.asyncio
    async def test_all_tiers_exhausted(self, simple_chain):
        async def mock_fail(self_chain, model, prompt, **kwargs):
            raise RuntimeError("Service unavailable")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            with pytest.raises(ModelExhaustedError):
                await simple_chain.generate("test prompt")

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens(self, simple_chain):
        async def mock_fail(self_chain, model, prompt, **kwargs):
            raise RuntimeError("Error")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            for _ in range(3):
                try:
                    await simple_chain.generate("test")
                except ModelExhaustedError:
                    pass

        model_a = simple_chain.models[0]
        assert model_a._consecutive_failures >= 3

    @pytest.mark.asyncio
    async def test_success_resets_circuit(self, simple_chain):
        simple_chain.models[0]._consecutive_failures = 3
        assert simple_chain.models[0].circuit_state == "half-open"

        async def mock_success(self_chain, model, prompt, **kwargs):
            return "OK"

        with patch.object(ModelFallbackChain, "_call_model", mock_success):
            await simple_chain.generate("test")

        assert simple_chain.models[0]._consecutive_failures == 0
        assert simple_chain.models[0].circuit_state == "closed"

    def test_get_status(self, simple_chain):
        status = simple_chain.get_status()
        assert "total_calls" in status
        assert "total_fallbacks" in status
        assert "fallback_rate" in status
        assert "models" in status
        assert len(status["models"]) == 2

    @pytest.mark.asyncio
    async def test_rate_limiting(self, simple_chain):
        model = simple_chain.models[0]
        model.max_rpm = 2
        assert simple_chain._check_rate_limit(model) is True
        assert simple_chain._check_rate_limit(model) is True
        assert simple_chain._check_rate_limit(model) is False

    @pytest.mark.asyncio
    async def test_generate_with_retry(self, simple_chain):
        attempts = 0

        async def mock_flaky(self_chain, model, prompt, **kwargs):
            nonlocal attempts
            attempts += 1
            if attempts <= 2:
                raise RuntimeError("Flaky")
            return "Works now"

        with patch.object(ModelFallbackChain, "_call_model", mock_flaky):
            result, name = await simple_chain.generate_with_retry("test", max_retries=2)
            assert result == "Works now"

    @pytest.mark.asyncio
    async def test_fallback_counts(self, simple_chain):
        async def mock_fail(self_chain, model, prompt, **kwargs):
            raise RuntimeError("Fail")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            try:
                await simple_chain.generate("test")
            except ModelExhaustedError:
                pass

        assert simple_chain._total_fallbacks > 0

    def test_model_tier_ordering(self):
        assert ModelTier.TIER_1_DEEPSEEK < ModelTier.TIER_2_QWEN
        assert ModelTier.TIER_2_QWEN < ModelTier.TIER_3_KIMI
        assert ModelTier.TIER_3_KIMI < ModelTier.TIER_4_REASONER
        assert ModelTier.TIER_4_REASONER < ModelTier.TIER_5_QWEN_MAX

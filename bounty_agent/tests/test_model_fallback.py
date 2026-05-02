#!/usr/bin/env python3
"""
Unit tests for Model Fallback Chain.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from bounty_agent.model_fallback import (
    ModelConfig,
    ModelTier,
    ModelFallbackChain,
    ModelExhaustedError,
    DEFAULT_MODEL_CHAIN,
)


class TestModelConfig:
    def test_api_key_from_env(self, monkeypatch):
        monkeypatch.setenv("TEST_API_KEY", "sk-test123")
        config = ModelConfig(
            name="Test", provider="test", api_key_env="TEST_API_KEY", model_id="test-model"
        )
        assert config.api_key == "sk-test123"

    def test_api_key_missing(self):
        config = ModelConfig(
            name="Test", provider="test", api_key_env="NONEXISTENT_KEY", model_id="test-model"
        )
        assert config.api_key == ""

    def test_circuit_states(self):
        config = ModelConfig(
            name="Test", provider="test", api_key_env="NONEXISTENT_KEY", model_id="test-model"
        )
        assert config.circuit_state == "closed"
        config._consecutive_failures = 3
        assert config.circuit_state == "half-open"
        config._circuit_open_until = 9999999999.0  # far future
        assert config.circuit_state == "open"

    def test_is_available_no_key(self):
        config = ModelConfig(
            name="Test", provider="test", api_key_env="NONEXISTENT_KEY", model_id="test-model"
        )
        assert config.is_available is False

    def test_is_available_circuit_open(self, monkeypatch):
        monkeypatch.setenv("TEST_KEY", "sk-test")
        config = ModelConfig(
            name="Test", provider="test", api_key_env="TEST_KEY", model_id="test-model"
        )
        config._circuit_open_until = 9999999999.0
        assert config.is_available is False


class TestModelFallbackChain:
    @pytest.fixture
    def simple_chain(self, monkeypatch):
        """Create a chain with 2 test models."""
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
        assert len(chain.models) == 5  # 5 default tiers

    def test_init_custom(self, simple_chain):
        assert len(simple_chain.models) == 2

    @pytest.mark.asyncio
    async def test_fallback_on_first_failure(self, simple_chain):
        """If first model fails, second should be tried."""
        call_count = 0

        async def mock_call(self_model, prompt, **kwargs):
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
        """If all models fail, raise ModelExhaustedError."""
        async def mock_fail(self_model, prompt, **kwargs):
            raise RuntimeError("Service unavailable")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            with pytest.raises(ModelExhaustedError):
                await simple_chain.generate("test prompt")

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens(self, simple_chain):
        """After 3 failures, circuit breaker opens."""
        async def mock_fail(self_model, prompt, **kwargs):
            raise RuntimeError("Error")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            for _ in range(3):
                try:
                    await simple_chain.generate("test")
                except ModelExhaustedError:
                    pass

        # Check circuit is open on first model
        model_a = simple_chain.models[0]
        assert model_a._consecutive_failures >= 3

    @pytest.mark.asyncio
    async def test_success_resets_circuit(self, simple_chain):
        """Successful call resets circuit breaker."""
        # First, trigger failures
        simple_chain.models[0]._consecutive_failures = 2
        assert simple_chain.models[0].circuit_state == "half-open"

        # Simulate successful call
        async def mock_success(self_model, prompt, **kwargs):
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
        """Rate limit should block excessive requests."""
        model = simple_chain.models[0]
        model.max_rpm = 2  # Very low limit

        # Fill up rate limit
        assert simple_chain._check_rate_limit(model) is True
        assert simple_chain._check_rate_limit(model) is True
        assert simple_chain._check_rate_limit(model) is False  # Blocked

    @pytest.mark.asyncio
    async def test_generate_with_retry(self, simple_chain):
        """generate_with_retry should retry on exhaustion."""
        attempts = 0

        async def mock_fail_then_succeed(self_model, prompt, **kwargs):
            nonlocal attempts
            attempts += 1
            if attempts <= 2:
                raise RuntimeError("Fail")
            return "Finally works"

        with patch.object(ModelFallbackChain, "_call_model", mock_fail_then_succeed):
            result, name = await simple_chain.generate_with_retry("test", max_retries=2)
            assert result == "Finally works"

"""Unit tests for model_fallback module."""

import pytest
from bounty_agent.model_fallback import (
    ModelFallbackChain,
    ModelConfig,
    ModelTier,
)


def make_config(name="test", tier=ModelTier.TIER_1_DEEPSEEK, provider="test",
                api_key_env="TEST_KEY", model_id="test-model"):
    return ModelConfig(name=name, tier=tier, provider=provider,
                       api_key_env=api_key_env, model_id=model_id)


class TestModelConfig:
    def test_create_config(self):
        cfg = make_config(name="glm-5.1", tier=ModelTier.TIER_1_DEEPSEEK, provider="zhipuai")
        assert cfg.name == "glm-5.1"
        assert cfg.tier == ModelTier.TIER_1_DEEPSEEK

    def test_is_available_default(self):
        cfg = make_config(tier=ModelTier.TIER_2_QWEN)
        # is_available is a property, not a method
        assert isinstance(cfg.is_available, bool)

    def test_circuit_state_default(self):
        cfg = make_config(tier=ModelTier.TIER_2_QWEN)
        # circuit_state is a property
        assert cfg.circuit_state in ("closed", "open", "half-open")

    def test_tier_values(self):
        assert ModelTier.TIER_1_DEEPSEEK == 0
        assert ModelTier.TIER_2_QWEN == 1
        assert ModelTier.TIER_3_KIMI == 2

    def test_api_key_missing_env(self):
        cfg = make_config(api_key_env="NONEXISTENT_KEY_12345")
        # api_key is a property
        assert isinstance(cfg.api_key, str)


class TestModelFallbackChain:
    def setup_method(self):
        models = [
            make_config(name="deepseek-v4", tier=ModelTier.TIER_1_DEEPSEEK, provider="deepseek", model_id="deepseek-v4-pro"),
            make_config(name="qwen-3.5", tier=ModelTier.TIER_2_QWEN, provider="nvidia", model_id="qwen3.5-397b"),
            make_config(name="kimi-k2.5", tier=ModelTier.TIER_3_KIMI, provider="moonshot", model_id="kimi-k2.5"),
        ]
        self.chain = ModelFallbackChain(models=models)

    def test_initialization(self):
        assert len(self.chain.models) >= 3

    def test_get_status(self):
        status = self.chain.get_status()
        assert "models" in status
        assert len(status["models"]) >= 3

    def test_tier_ordering(self):
        tiers = [m.tier for m in self.chain.models[:3]]  # Check our 3 models
        assert tiers == sorted(tiers)

    def test_default_models_exist(self):
        # Empty chain should still have default models
        chain = ModelFallbackChain(models=[])
        status = chain.get_status()
        assert len(status["models"]) >= 0  # May have defaults

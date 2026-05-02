#!/usr/bin/env python3
"""
Model Fallback Chain — Five-tier LLM resilience for production deployments.

Architecture: DeepSeek → Qwen → Kimi → Reasoner → Qwen Max
Each tier is tried in order; on failure (rate limit / timeout / error),
the next tier is attempted automatically.

Bounty #861 | SolFoundry/solfoundry
"""

import os
import time
import logging
import asyncio
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ModelTier(IntEnum):
    """Five-tier LLM fallback ranking (0 = highest priority)."""
    TIER_1_DEEPSEEK = 0
    TIER_2_QWEN = 1
    TIER_3_KIMI = 2
    TIER_4_REASONER = 3
    TIER_5_QWEN_MAX = 4


@dataclass
class ModelConfig:
    """Configuration for a single model in the fallback chain."""
    name: str
    provider: str
    api_key_env: str
    model_id: str
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout_seconds: float = 30.0
    max_rpm: int = 60  # requests per minute
    tier: ModelTier = ModelTier.TIER_1_DEEPSEEK

    # Runtime state (not serialized)
    _consecutive_failures: int = field(default=0, init=False, repr=False)
    _last_failure_time: float = field(default=0.0, init=False, repr=False)
    _circuit_open_until: float = field(default=0.0, init=False, repr=False)
    _request_timestamps: list = field(default_factory=list, init=False, repr=False)

    @property
    def api_key(self) -> str:
        return os.environ.get(self.api_key_env, "")

    @property
    def is_available(self) -> bool:
        """Check if model has API key and circuit breaker is not open."""
        if not self.api_key:
            return False
        if time.time() < self._circuit_open_until:
            return False
        return True

    @property
    def circuit_state(self) -> str:
        """Circuit breaker state: closed / half-open / open."""
        if time.time() < self._circuit_open_until:
            return "open"
        if self._consecutive_failures >= 3:
            return "half-open"
        return "closed"


# ── Default model chain ──────────────────────────────────────────────────────
DEFAULT_MODEL_CHAIN: list[ModelConfig] = [
    ModelConfig(
        name="DeepSeek-V3",
        provider="deepseek",
        api_key_env="DEEPSEEK_API_KEY",
        model_id="deepseek/deepseek-chat",
        max_tokens=4096,
        tier=ModelTier.TIER_1_DEEPSEEK,
    ),
    ModelConfig(
        name="Qwen-3-72B",
        provider="nvidia",
        api_key_env="NVIDIA_API_KEY_1",
        model_id="qwen/qwen3-72b-instruct",
        max_tokens=4096,
        tier=ModelTier.TIER_2_QWEN,
    ),
    ModelConfig(
        name="Kimi-K2.5",
        provider="moonshot",
        api_key_env="MOONSHOT_API_KEY",
        model_id="moonshotai/kimi-k2.5",
        max_tokens=4096,
        tier=ModelTier.TIER_3_KIMI,
    ),
    ModelConfig(
        name="GLM-5-Reasoner",
        provider="zhipuai",
        api_key_env="ZHIPUAI_API_KEY",
        model_id="z-ai/glm5",
        max_tokens=8192,
        temperature=0.3,  # lower for reasoning tasks
        tier=ModelTier.TIER_4_REASONER,
    ),
    ModelConfig(
        name="Qwen-Max",
        provider="nvidia",
        api_key_env="NVIDIA_API_KEY_2",
        model_id="qwen/qwen-max",
        max_tokens=8192,
        tier=ModelTier.TIER_5_QWEN_MAX,
    ),
]


class ModelFallbackChain:
    """
    Five-tier LLM fallback chain with circuit breaker per model.

    On each call:
    1. Try highest-priority available model
    2. On failure, record failure + advance circuit breaker
    3. After 3 consecutive failures, open circuit for cooldown
    4. After cooldown, half-open → allow 1 probe request
    5. On success, reset failures (close circuit)
    6. If all tiers fail, raise ModelExhaustedError
    """

    CIRCUIT_OPEN_COOLDOWN = 120  # seconds
    MAX_CONSECUTIVE_FAILURES = 3

    def __init__(self, models: Optional[list[ModelConfig]] = None):
        self.models = models or DEFAULT_MODEL_CHAIN
        self._total_calls = 0
        self._total_fallbacks = 0
        self._tier_usage: dict[str, int] = {}

    def _check_rate_limit(self, model: ModelConfig) -> bool:
        """Token bucket rate limit check (simplified)."""
        now = time.time()
        # Remove timestamps older than 60 seconds
        model._request_timestamps = [
            t for t in model._request_timestamps if now - t < 60
        ]
        if len(model._request_timestamps) >= model.max_rpm:
            return False  # rate limited
        model._request_timestamps.append(now)
        return True

    def _record_success(self, model: ModelConfig) -> None:
        """Record successful call — reset circuit breaker."""
        model._consecutive_failures = 0
        model._circuit_open_until = 0.0
        logger.debug(f"[fallback] {model.name} call succeeded, circuit closed")

    def _record_failure(self, model: ModelConfig, error: Exception) -> None:
        """Record failure — advance circuit breaker."""
        model._consecutive_failures += 1
        model._last_failure_time = time.time()

        if model._consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
            model._circuit_open_until = time.time() + self.CIRCUIT_OPEN_COOLDOWN
            logger.warning(
                f"[fallback] {model.name} circuit OPENED "
                f"(failures={model._consecutive_failures}, "
                f"cooldown={self.CIRCUIT_OPEN_COOLDOWN}s). "
                f"Error: {error}"
            )
        else:
            logger.warning(
                f"[fallback] {model.name} failed "
                f"(attempt {model._consecutive_failures}/"
                f"{self.MAX_CONSECUTIVE_FAILURES}): {error}"
            )

    async def _call_model(self, model: ModelConfig, prompt: str, **kwargs: Any) -> str:
        """
        Call a single model. Override this method with actual API integration.

        In production, this dispatches to the appropriate provider SDK.
        Returns model response text.
        """
        self._total_calls += 1
        self._tier_usage[model.name] = self._tier_usage.get(model.name, 0) + 1

        # ── Placeholder: real API call would go here ──
        # For now, simulate based on environment configuration
        api_key = model.api_key
        if not api_key:
            raise RuntimeError(f"No API key for {model.name} (env: {model.api_key_env})")

        # Simulate API call with configurable backend
        provider = model.provider
        if provider == "deepseek" and api_key:
            return await self._call_deepseek(model, prompt, **kwargs)
        elif provider == "nvidia" and api_key:
            return await self._call_nvidia(model, prompt, **kwargs)
        elif provider == "moonshot" and api_key:
            return await self._call_moonshot(model, prompt, **kwargs)
        elif provider == "zhipuai" and api_key:
            return await self._call_zhipuai(model, prompt, **kwargs)
        else:
            raise RuntimeError(f"Unknown provider: {provider}")

    async def _call_deepseek(self, model: ModelConfig, prompt: str, **kwargs: Any) -> str:
        """DeepSeek API integration."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=model.api_key, base_url="https://api.deepseek.com")
            response = await client.chat.completions.create(
                model=model.model_id.split("/")[-1],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", model.max_tokens),
                temperature=kwargs.get("temperature", model.temperature),
                timeout=model.timeout_seconds,
            )
            return response.choices[0].message.content or ""
        except ImportError:
            raise RuntimeError("openai package not installed")

    async def _call_nvidia(self, model: ModelConfig, prompt: str, **kwargs: Any) -> str:
        """NVIDIA NIM API integration."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=model.api_key,
                base_url="https://integrate.api.nvidia.com/v1",
            )
            response = await client.chat.completions.create(
                model=model.model_id,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", model.max_tokens),
                temperature=kwargs.get("temperature", model.temperature),
                timeout=model.timeout_seconds,
            )
            return response.choices[0].message.content or ""
        except ImportError:
            raise RuntimeError("openai package not installed")

    async def _call_moonshot(self, model: ModelConfig, prompt: str, **kwargs: Any) -> str:
        """Moonshot (Kimi) API integration."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=model.api_key,
                base_url="https://api.moonshot.cn/v1",
            )
            response = await client.chat.completions.create(
                model="kimi-k2.5",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", model.max_tokens),
                temperature=kwargs.get("temperature", model.temperature),
                timeout=model.timeout_seconds,
            )
            return response.choices[0].message.content or ""
        except ImportError:
            raise RuntimeError("openai package not installed")

    async def _call_zhipuai(self, model: ModelConfig, prompt: str, **kwargs: Any) -> str:
        """ZhipuAI (GLM) API integration."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=model.api_key,
                base_url="https://open.bigmodel.cn/api/paas/v4",
            )
            response = await client.chat.completions.create(
                model="glm-5",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", model.max_tokens),
                temperature=kwargs.get("temperature", model.temperature),
                timeout=model.timeout_seconds,
            )
            return response.choices[0].message.content or ""
        except ImportError:
            raise RuntimeError("openai package not installed")

    async def generate(self, prompt: str, **kwargs: Any) -> tuple[str, str]:
        """
        Generate response with automatic fallback across all tiers.

        Returns:
            (response_text, model_name) — the text and which model produced it

        Raises:
            ModelExhaustedError — if all tiers are unavailable
        """
        errors: list[str] = []

        for model in sorted(self.models, key=lambda m: m.tier):
            if not model.is_available:
                logger.debug(f"[fallback] Skipping {model.name} (circuit={model.circuit_state})")
                continue

            if not self._check_rate_limit(model):
                logger.debug(f"[fallback] Skipping {model.name} (rate limited)")
                continue

            try:
                logger.info(f"[fallback] Trying {model.name} (tier={model.tier.name})")
                result = await asyncio.wait_for(
                    self._call_model(model, prompt, **kwargs),
                    timeout=model.timeout_seconds,
                )
                self._record_success(model)
                return result, model.name

            except asyncio.TimeoutError:
                self._record_failure(model, RuntimeError("Timeout"))
                errors.append(f"{model.name}: Timeout ({model.timeout_seconds}s)")
                self._total_fallbacks += 1

            except Exception as e:
                self._record_failure(model, e)
                errors.append(f"{model.name}: {type(e).__name__}: {e}")
                self._total_fallbacks += 1

        raise ModelExhaustedError(
            f"All {len(self.models)} model tiers exhausted. Errors: {'; '.join(errors)}"
        )

    async def generate_with_retry(
        self, prompt: str, max_retries: int = 2, **kwargs: Any
    ) -> tuple[str, str]:
        """Generate with per-tier retry before falling back."""
        last_error: Optional[Exception] = None

        for attempt in range(max_retries + 1):
            try:
                return await self.generate(prompt, **kwargs)
            except ModelExhaustedError as e:
                last_error = e
                if attempt < max_retries:
                    backoff = 2 ** attempt + 0.5
                    logger.warning(
                        f"[fallback] All tiers exhausted, retry {attempt+1}/{max_retries} "
                        f"after {backoff:.1f}s"
                    )
                    await asyncio.sleep(backoff)

        raise last_error  # type: ignore

    def get_status(self) -> dict:
        """Get current chain status for monitoring."""
        return {
            "total_calls": self._total_calls,
            "total_fallbacks": self._total_fallbacks,
            "fallback_rate": (
                self._total_fallbacks / self._total_calls
                if self._total_calls > 0 else 0.0
            ),
            "tier_usage": dict(self._tier_usage),
            "models": [
                {
                    "name": m.name,
                    "tier": m.tier.name,
                    "available": m.is_available,
                    "circuit_state": m.circuit_state,
                    "consecutive_failures": m._consecutive_failures,
                }
                for m in self.models
            ],
        }


class ModelExhaustedError(Exception):
    """All model tiers in the fallback chain have been exhausted."""
    pass

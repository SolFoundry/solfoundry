"""Configuration management for the bounty agent system.

Supports: JSON config files, environment variables, runtime overrides.
Validates all config values and provides defaults.
Author: Xeophon
"""
import os
import json
import logging
from dataclasses import dataclass, field
from typing import Dict, List
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class GatewayConfig:
    """Single gateway configuration."""
    gateway_id: int = 1
    port: int = 18789
    host: str = "0.0.0.0"
    memory_limit_mb: float = 850.0
    max_agents: int = 10
    restart_on_failure: bool = True


@dataclass
class EconomicConfig:
    """Economic system configuration."""
    initial_agent_tokens: float = 10.0
    bounty_commission_rate: float = 0.01  # 1% conversion
    settlement_retry_limit: int = 3
    settlement_timeout: float = 300.0
    team_wallet: str = "Lt9nERv6VHsojw15LpFeiaabuphAggzfLF9sM9UXRrZ"


@dataclass
class RelayConfig:
    """Inter-agent relay configuration."""
    max_hops: int = 5
    max_retries: int = 3
    retry_base_delay: float = 1.0
    rate_limit_per_minute: int = 30
    seen_links_max: int = 1000
    relay_mode: str = "native"  # native | feishu


@dataclass
class SchedulerConfig:
    """Agent scheduler configuration."""
    memory_high_watermark: float = 0.9
    memory_critical: float = 0.95
    memory_low_watermark: float = 0.7
    max_queue_size: int = 1000
    heartbeat_timeout: int = 300
    auto_tier_promotion: bool = True
    peak_hours: List = field(default_factory=lambda: [[9, 12], [14, 18]])


@dataclass
class BountyAgentConfig:
    """Root configuration for the entire bounty agent system."""
    agent_name: str = "bounty-agent"
    version: str = "1.0.0"
    log_level: str = "INFO"
    environment: str = "production"

    gateway: GatewayConfig = field(default_factory=GatewayConfig)
    economic: EconomicConfig = field(default_factory=EconomicConfig)
    relay: RelayConfig = field(default_factory=RelayConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)

    # LLM provider configurations
    llm_providers: Dict[str, Dict] = field(default_factory=dict)

    # Bounty platform API endpoints
    bounty_platforms: Dict[str, str] = field(default_factory=lambda: {
        "solfoundry": "https://api.solfoundry.com",
        "rustchain": "https://bounties.rustchain.io",
    })

    # Security
    allowed_repos: List[str] = field(default_factory=list)
    blocked_repos: List[str] = field(default_factory=list)
    max_prs_per_day: int = 10

    @classmethod
    def from_file(cls, path: str) -> "BountyAgentConfig":
        """Load configuration from a JSON file with env var overrides."""
        config_path = Path(path)
        if not config_path.exists():
            logger.warning(f"[config] {path} not found, using defaults")
            return cls()

        with open(config_path) as f:
            data = json.load(f)

        config = cls()

        # Apply top-level settings
        for key in ("agent_name", "version", "log_level", "environment"):
            if key in data:
                setattr(config, key, data[key])

        # Apply nested configs
        if "gateway" in data:
            for k, v in data["gateway"].items():
                if hasattr(config.gateway, k):
                    setattr(config.gateway, k, v)

        if "economic" in data:
            for k, v in data["economic"].items():
                if hasattr(config.economic, k):
                    setattr(config.economic, k, v)

        if "relay" in data:
            for k, v in data["relay"].items():
                if hasattr(config.relay, k):
                    setattr(config.relay, k, v)

        if "scheduler" in data:
            for k, v in data["scheduler"].items():
                if hasattr(config.scheduler, k):
                    setattr(config.scheduler, k, v)

        if "llm_providers" in data:
            config.llm_providers = data["llm_providers"]

        if "bounty_platforms" in data:
            config.bounty_platforms = data["bounty_platforms"]

        # Environment variable overrides (BOUNTY_AGENT_* prefix)
        for key in ("agent_name", "log_level", "environment"):
            env_val = os.getenv(f"BOUNTY_AGENT_{key.upper()}")
            if env_val:
                setattr(config, key, env_val)

        # Special env vars
        env_gw_id = os.getenv("GATEWAY_ID")
        if env_gw_id:
            config.gateway.gateway_id = int(env_gw_id)

        env_port = os.getenv("GATEWAY_PORT")
        if env_port:
            config.gateway.port = int(env_port)

        logger.info(f"[config] Loaded from {path} (env={config.environment})")
        return config

    def validate(self) -> List[str]:
        """Validate configuration and return list of issues."""
        issues = []
        if self.gateway.memory_limit_mb < 256:
            issues.append(f"gateway.memory_limit_mb too low: {self.gateway.memory_limit_mb}")
        if self.relay.max_hops < 1:
            issues.append(f"relay.max_hops must be >= 1: {self.relay.max_hops}")
        if self.economic.settlement_retry_limit < 1:
            issues.append("economic.settlement_retry_limit must be >= 1")
        if self.scheduler.memory_high_watermark >= 1.0:
            issues.append("scheduler.memory_high_watermark must be < 1.0")
        return issues

    def to_dict(self) -> Dict:
        """Serialize config to dictionary."""
        import dataclasses
        result = {}
        for fld in dataclasses.fields(self):
            val = getattr(self, fld.name)
            if dataclasses.is_dataclass(val):
                result[fld.name] = dataclasses.asdict(val)
            else:
                result[fld.name] = val
        return result

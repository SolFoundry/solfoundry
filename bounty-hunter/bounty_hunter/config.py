"""Configuration and environment management for the bounty hunter."""

import os
from dataclasses import dataclass, field


@dataclass
class EnvConfig:
    """Environment variable configuration."""

    github_token: str = ""
    wallet_address: str = ""
    repo_owner: str = "SolFoundry"
    repo_name: str = "solfoundry"
    llm_api_key: str = ""
    llm_endpoint: str = ""
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "EnvConfig":
        return cls(
            github_token=os.environ.get("GITHUB_TOKEN", ""),
            wallet_address=os.environ.get("WALLET_ADDRESS", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"),
            repo_owner=os.environ.get("REPO_OWNER", "SolFoundry"),
            repo_name=os.environ.get("REPO_NAME", "solfoundry"),
            llm_api_key=os.environ.get("LLM_API_KEY", ""),
            llm_endpoint=os.environ.get("LLM_ENDPOINT", ""),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )


@dataclass
class Config:
    """Full configuration."""

    env: EnvConfig = field(default_factory=EnvConfig.from_env)
    max_retries: int = 3
    pr_branch_prefix: str = "feat/bounty"
    verbose: bool = False

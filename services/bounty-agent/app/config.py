"""Configuration management for Bounty Agent."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "glm-5.1:cloud")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    TARGET_REPOS: list[str] = os.getenv("TARGET_REPOS", "SolFoundry/solfoundry").split(",")
    DRY_RUN: bool = os.getenv("DRY_RUN", "true").lower() == "true"
    MAX_BOUNTIES: int = int(os.getenv("MAX_BOUNTIES", "5"))
    WORKSPACE_ROOT: Path = Path(os.getenv("WORKSPACE_ROOT", "/tmp/bounty-agent"))
    PR_BRANCH_PREFIX: str = "feat/bounty"

    @property
    def llm_headers(self) -> dict:
        if self.LLM_PROVIDER == "ollama":
            return {"Authorization": f"Bearer {self.GITHUB_TOKEN}"}
        return {}


config = Config()
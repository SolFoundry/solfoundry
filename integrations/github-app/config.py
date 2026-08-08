"""Review configuration models for the AI Code Review GitHub App."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ReviewMode(str, Enum):
    """Review mode determines how many LLM models are used."""
    QUICK = "quick"        # 1 model, fast turnaround
    STANDARD = "standard"  # 3 models, balanced
    THOROUGH = "thorough"  # 5 models, deep analysis


class StrictnessLevel(str, Enum):
    """Strictness level for reviews."""
    LENIENT = "lenient"    # Flag only critical/high issues
    BALANCED = "balanced"  # Default — flag all issues
    STRICT = "strict"      # Flag everything, including style nits


class CommentStyle(str, Enum):
    """How review comments are posted."""
    INLINE = "inline"      # Comments on specific lines
    SUMMARY = "summary"    # Single summary comment
    BOTH = "both"          # Inline comments + summary


class ReviewConfig(BaseModel):
    """Per-repository review configuration."""
    mode: ReviewMode = ReviewMode.STANDARD
    strictness: StrictnessLevel = StrictnessLevel.BALANCED
    comment_style: CommentStyle = CommentStyle.INLINE
    max_reviewers: int = Field(default=3, ge=1, le=5)
    auto_approve_threshold: Optional[float] = Field(default=8.0, ge=0, le=10)
    block_threshold: Optional[float] = Field(default=4.0, ge=0, le=10)
    skip_paths: list[str] = Field(default_factory=lambda: [
        "*.lock", "*.min.js", "*.min.css", "vendor/*", "node_modules/*",
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml"
    ])
    languages: list[str] = Field(default_factory=lambda: [
        "python", "javascript", "typescript", "go", "rust", "java",
        "solidity", "ruby", "kotlin", "swift", "cpp", "c"
    ])

    @classmethod
    def default(cls) -> "ReviewConfig":
        return cls()

    def get_score_threshold(self) -> float:
        """Return the minimum score for a passing review."""
        if self.strictness == StrictnessLevel.LENIENT:
            return 6.0
        elif self.strictness == StrictnessLevel.BALANCED:
            return 7.0
        return 8.0  # strict


class AppConfig(BaseModel):
    """Global application configuration."""
    github_app_id: str = ""
    github_private_key: str = ""
    github_webhook_secret: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

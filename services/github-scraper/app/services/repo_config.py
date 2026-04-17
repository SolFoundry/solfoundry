"""Repository configuration management — YAML-based with runtime API support."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import yaml

from app.models import RepoConfig, RepoConfigList

logger = logging.getLogger(__name__)


class RepoConfigManager:
    """Manages the list of repositories to scrape.

    Loads from a YAML file on startup and supports runtime additions
    via the API. Changes are persisted back to the YAML file.
    """

    def __init__(self, config_path: str = "./repos.yaml"):
        self.config_path = Path(config_path)
        self._repos: dict[str, RepoConfig] = {}
        self._load()

    def _load(self) -> None:
        """Load repository configuration from YAML file."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    data = yaml.safe_load(f) or {}
                config = RepoConfigList(**data)
                for repo in config.repositories:
                    self._repos[repo.full_name] = repo
                logger.info("Loaded %d repositories from %s", len(self._repos), self.config_path)
            except Exception as e:
                logger.error("Failed to load repo config from %s: %s", self.config_path, e)
        else:
            logger.info("No repo config found at %s, starting empty", self.config_path)
            # Write default config
            self._save()

    def _save(self) -> None:
        """Persist current configuration to YAML file."""
        config = RepoConfigList(repositories=list(self._repos.values()))
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w") as f:
                yaml.dump(config.model_dump(), f, default_flow_style=False, sort_keys=False)
            logger.debug("Saved repo config to %s", self.config_path)
        except Exception as e:
            logger.error("Failed to save repo config: %s", e)

    def list_repos(self, enabled_only: bool = False) -> list[RepoConfig]:
        """List all configured repositories."""
        repos = list(self._repos.values())
        if enabled_only:
            repos = [r for r in repos if r.enabled]
        return repos

    def get_repo(self, owner: str, repo: str) -> Optional[RepoConfig]:
        """Get a specific repository configuration."""
        return self._repos.get(f"{owner}/{repo}")

    def add_repo(self, config: RepoConfig) -> RepoConfig:
        """Add or update a repository configuration."""
        self._repos[config.full_name] = config
        self._save()
        logger.info("Added repo: %s", config.full_name)
        return config

    def remove_repo(self, owner: str, repo: str) -> bool:
        """Remove a repository from the watch list."""
        key = f"{owner}/{repo}"
        if key in self._repos:
            del self._repos[key]
            self._save()
            logger.info("Removed repo: %s", key)
            return True
        return False

    def enable_repo(self, owner: str, repo: str) -> bool:
        """Enable a watched repository."""
        cfg = self.get_repo(owner, repo)
        if cfg:
            cfg.enabled = True
            self._save()
            return True
        return False

    def disable_repo(self, owner: str, repo: str) -> bool:
        """Disable a watched repository."""
        cfg = self.get_repo(owner, repo)
        if cfg:
            cfg.enabled = False
            self._save()
            return True
        return False
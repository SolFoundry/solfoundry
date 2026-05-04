"""Tests for ScraperConfig."""

import os
import tempfile
from pathlib import Path

from github_scraper.models.config import ScraperConfig, RepoSource


class TestRepoSource:
    def test_full_name(self):
        repo = RepoSource(owner="SolFoundry", repo="SolFoundry")
        assert repo.full_name == "SolFoundry/SolFoundry"

    def test_from_dict(self):
        data = {"owner": "test", "repo": "repo", "priority": 5}
        repo = RepoSource.from_dict(data)
        assert repo.owner == "test"
        assert repo.priority == 5

    def test_from_dict_defaults(self):
        data = {"owner": "test", "repo": "repo"}
        repo = RepoSource.from_dict(data)
        assert repo.label_filter == ["bounty", "bug", "feature", "help wanted"]
        assert repo.state_filter == "open"


class TestScraperConfig:
    def test_from_yaml(self):
        yaml_content = """repos:
  - owner: test
    repo: repo1
    priority: 10
  - owner: test
    repo: repo2
poll_interval_seconds: 60
webhook_port: 9090
"""
        fd, path = tempfile.mkstemp(suffix=".yaml")
        try:
            with os.fdopen(fd, 'w') as f:
                f.write(yaml_content)
            config = ScraperConfig.from_yaml(path)
            assert len(config.repos) == 2
            assert config.poll_interval_seconds == 60
            assert config.webhook_port == 9090
            assert config.repos[0].priority == 10
        finally:
            os.unlink(path)

    def test_empty_yaml(self):
        fd, path = tempfile.mkstemp(suffix=".yaml")
        try:
            with os.fdopen(fd, 'w') as f:
                f.write("")
            config = ScraperConfig.from_yaml(path)
            assert config.repos == []
            assert config.poll_interval_seconds == 300
        finally:
            os.unlink(path)

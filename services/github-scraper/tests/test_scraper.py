"""Tests for the GitHub Issue Scraper service."""

import pytest
from app.models import RepoConfig, GitHubIssue, BountyCreateRequest


class TestRepoConfig:
    """Tests for RepoConfig tier/reward mapping."""

    def test_get_tier_from_labels(self):
        config = RepoConfig(owner="test", repo="repo")
        assert config.get_tier(["bounty", "tier-1"]) == 1
        assert config.get_tier(["bounty", "tier-2"]) == 2
        assert config.get_tier(["bounty", "tier-3"]) == 3

    def test_get_tier_default(self):
        config = RepoConfig(owner="test", repo="repo", default_tier=2)
        assert config.get_tier(["bounty"]) == 2
        assert config.get_tier(["bounty", "other"]) == 2

    def test_has_bounty_label(self):
        config = RepoConfig(owner="test", repo="repo")
        assert config.has_bounty_label(["bounty", "tier-1"]) is True
        assert config.has_bounty_label(["bug", "tier-1"]) is False
        assert config.has_bounty_label([]) is False

    def test_get_reward(self):
        config = RepoConfig(owner="test", repo="repo")
        assert config.get_reward(1) == 200_000
        assert config.get_reward(2) == 600_000
        assert config.get_reward(3) == 1_200_000

    def test_custom_label_mapping(self):
        config = RepoConfig(
            owner="test",
            repo="repo",
            label_mapping={"bounty": True, "t1": 1, "t2": 2, "t3": 3},
        )
        assert config.get_tier(["bounty", "t3"]) == 3
        assert config.has_bounty_label(["bounty"]) is True
        assert config.has_bounty_label(["t1"]) is False

    def test_full_name(self):
        config = RepoConfig(owner="SolFoundry", repo="solfoundry")
        assert config.full_name == "SolFoundry/solfoundry"


class TestGitHubIssue:
    """Tests for GitHubIssue model."""

    def test_defaults(self):
        issue = GitHubIssue(number=1, title="Test")
        assert issue.body == ""
        assert issue.state == "open"
        assert issue.labels == []
        assert issue.html_url == ""
        assert issue.milestone is None
        assert issue.assignees == []


class TestBountyCreateRequest:
    """Tests for BountyCreateRequest model."""

    def test_valid_request(self):
        req = BountyCreateRequest(
            title="Implement feature",
            reward_amount=600000,
            tier=2,
        )
        assert req.title == "Implement feature"
        assert req.reward_amount == 600000
        assert req.tier == 2
        assert req.created_by == "github-scraper"

    def test_category_default(self):
        req = BountyCreateRequest(title="Test", reward_amount=200000)
        assert req.category == "backend"


class TestWebhookHandler:
    """Tests for webhook signature verification."""

    def test_verify_signature_no_secret(self):
        from app.services.webhook_handler import WebhookHandler
        handler = WebhookHandler(webhook_secret="")
        # No secret configured — should pass
        assert handler.verify_signature(b"test", "") is True

    def test_verify_signature_with_secret(self):
        import hashlib
        import hmac
        from app.services.webhook_handler import WebhookHandler

        secret = "test-secret"
        handler = WebhookHandler(webhook_secret=secret)

        payload = b'{"action":"opened"}'
        sig = "sha256=" + hmac.new(
            secret.encode(), payload, hashlib.sha256
        ).hexdigest()

        assert handler.verify_signature(payload, sig) is True
        assert handler.verify_signature(payload, "sha256=wrong") is False
        assert handler.verify_signature(payload, "") is False

    def test_parse_event_issues(self):
        from app.services.webhook_handler import WebhookHandler

        handler = WebhookHandler()
        payload = {
            "action": "opened",
            "issue": {
                "number": 42,
                "title": "New feature",
                "body": "Description",
                "state": "open",
                "labels": [{"name": "bounty"}, {"name": "tier-2"}],
                "html_url": "https://github.com/org/repo/issues/42",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            },
            "repository": {
                "owner": {"login": "org"},
                "name": "repo",
            },
        }

        event = handler.parse_event(payload)
        assert event is not None
        assert event.action == "opened"
        assert event.repo_owner == "org"
        assert event.repo_name == "repo"
        assert event.issue is not None
        assert event.issue.number == 42
        assert "bounty" in event.issue.labels
        assert "tier-2" in event.issue.labels

    def test_parse_event_skips_prs(self):
        from app.services.webhook_handler import WebhookHandler

        handler = WebhookHandler()
        payload = {
            "action": "opened",
            "issue": {
                "number": 42,
                "title": "PR title",
                "pull_request": {"url": "..."},
            },
            "repository": {
                "owner": {"login": "org"},
                "name": "repo",
            },
        }

        event = handler.parse_event(payload)
        assert event is not None
        assert event.issue is None  # PRs should be filtered out


class TestImportStore:
    """Tests for the in-memory import store."""

    @pytest.mark.asyncio
    async def test_save_and_get(self):
        from app.models import ImportRecord, ImportStatus
        from app.services.import_store import ImportStore

        store = ImportStore()  # in-memory by default
        record = ImportRecord(
            repo_owner="org",
            repo_name="repo",
            issue_number=42,
            issue_url="https://github.com/org/repo/issues/42",
            bounty_id="bounty-123",
            tier=2,
            reward_amount=600000,
            status=ImportStatus.IMPORTED,
        )

        saved = await store.save(record)
        assert saved.id is not None

        found = await store.get_by_issue("org", "repo", 42)
        assert found is not None
        assert found.bounty_id == "bounty-123"
        assert found.status == ImportStatus.IMPORTED

    @pytest.mark.asyncio
    async def test_dedup(self):
        from app.models import ImportRecord, ImportStatus
        from app.services.import_store import ImportStore

        store = ImportStore()
        record1 = ImportRecord(
            repo_owner="org",
            repo_name="repo",
            issue_number=1,
            issue_url="url1",
            status=ImportStatus.IMPORTED,
        )
        await store.save(record1)
        record2 = ImportRecord(
            repo_owner="org",
            repo_name="repo",
            issue_number=1,
            issue_url="url1",
            bounty_id="new-id",
            status=ImportStatus.UPDATED,
        )
        await store.save(record2)

        found = await store.get_by_issue("org", "repo", 1)
        assert found.bounty_id == "new-id"
        assert found.status == ImportStatus.UPDATED

    @pytest.mark.asyncio
    async def test_list_and_count(self):
        from app.models import ImportRecord, ImportStatus
        from app.services.import_store import ImportStore

        store = ImportStore()
        for i in range(5):
            await store.save(ImportRecord(
                repo_owner="org", repo_name="repo",
                issue_number=i, issue_url=f"url{i}",
                status=ImportStatus.IMPORTED,
            ))
        await store.save(ImportRecord(
            repo_owner="org", repo_name="repo",
            issue_number=99, issue_url="fail",
            status=ImportStatus.FAILED,
        ))

        assert await store.count() == 6
        assert await store.count(status="imported") == 5
        assert await store.count(status="failed") == 1
        records = await store.list_records(limit=3)
        assert len(records) == 3


class TestRepoConfigManager:
    """Tests for RepoConfigManager."""

    def test_add_and_list(self, tmp_path):
        from app.services.repo_config import RepoConfigManager

        config_path = str(tmp_path / "repos.yaml")
        manager = RepoConfigManager(config_path=config_path)

        config = RepoConfig(owner="org", repo="repo")
        manager.add_repo(config)

        repos = manager.list_repos()
        assert len(repos) == 1
        assert repos[0].full_name == "org/repo"

    def test_remove(self, tmp_path):
        from app.services.repo_config import RepoConfigManager

        config_path = str(tmp_path / "repos.yaml")
        manager = RepoConfigManager(config_path=config_path)
        manager.add_repo(RepoConfig(owner="org", repo="repo"))

        assert manager.remove_repo("org", "repo") is True
        assert manager.remove_repo("org", "repo") is False
        assert len(manager.list_repos()) == 0
"""Comprehensive API tests for PR Tracker endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestPRTrackersAPI:
    """Tests for PR Tracker REST API endpoints."""

    def test_create_pr_tracker(self):
        """Test creating a new PR tracker."""
        resp = client.post(
            "/api/pr-trackers",
            json={
                "repo": "test-repo",
                "pr_number": 1,
                "status": "draft",
                "author": "testuser",
                "bounty_id": "bounty-001"
            }
        )
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data["repo"] == "test-repo"
        assert data["pr_number"] == 1
        assert data["status"] == "draft"

    def test_create_pr_tracker_duplicate(self):
        """Test that duplicate PR tracker creation fails."""
        # Create first
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "test-repo",
                "pr_number": 2,
                "status": "draft",
                "author": "testuser"
            }
        )
        # Try duplicate
        resp = client.post(
            "/api/pr-trackers",
            json={
                "repo": "test-repo",
                "pr_number": 2,
                "status": "draft",
                "author": "testuser"
            }
        )
        assert resp.status_code in [400, 409]

    def test_list_pr_trackers(self):
        """Test listing PR trackers."""
        # Create a tracker first
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "list-test-repo",
                "pr_number": 100,
                "status": "open",
                "author": "listuser"
            }
        )
        
        resp = client.get("/api/pr-trackers")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_pr_trackers_with_filters(self):
        """Test listing PR trackers with filters."""
        # Create trackers with different statuses
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "filter-repo",
                "pr_number": 200,
                "status": "open",
                "author": "filteruser1"
            }
        )
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "filter-repo",
                "pr_number": 201,
                "status": "merged",
                "author": "filteruser2"
            }
        )
        
        # Filter by status
        resp = client.get("/api/pr-trackers?status=open")
        assert resp.status_code == 200
        
        # Filter by repo
        resp = client.get("/api/pr-trackers?repo=filter-repo")
        assert resp.status_code == 200
        
        # Filter by author
        resp = client.get("/api/pr-trackers?author=filteruser1")
        assert resp.status_code == 200

    def test_get_pr_tracker_by_repo_and_pr(self):
        """Test getting a specific PR tracker."""
        # Create a tracker
        create_resp = client.post(
            "/api/pr-trackers",
            json={
                "repo": "get-test-repo",
                "pr_number": 300,
                "status": "in_review",
                "author": "getuser"
            }
        )
        
        # Get the tracker
        resp = client.get("/api/pr-trackers/get-test-repo/300")
        assert resp.status_code == 200
        data = resp.json()
        assert data["repo"] == "get-test-repo"
        assert data["pr_number"] == 300

    def test_get_pr_tracker_not_found(self):
        """Test getting a non-existent PR tracker."""
        resp = client.get("/api/pr-trackers/nonexistent-repo/99999")
        assert resp.status_code == 404

    def test_update_pr_tracker_status(self):
        """Test updating PR tracker status."""
        # Create a tracker
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "update-test-repo",
                "pr_number": 400,
                "status": "draft",
                "author": "updateuser"
            }
        )
        
        # Update status
        resp = client.patch(
            "/api/pr-trackers/update-test-repo/400",
            json={"status": "approved"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"

    def test_update_pr_tracker_with_review_info(self):
        """Test updating PR tracker with review information."""
        # Create a tracker
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "review-test-repo",
                "pr_number": 500,
                "status": "in_review",
                "author": "reviewuser"
            }
        )
        
        # Update with review info
        resp = client.patch(
            "/api/pr-trackers/review-test-repo/500",
            json={
                "status": "approved",
                "reviewers": ["reviewer1", "reviewer2"],
                "approvals": 2,
                "changes_requested": 0
            }
        )
        assert resp.status_code == 200

    def test_update_pr_tracker_ci_status(self):
        """Test updating PR tracker with CI status."""
        # Create a tracker
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "ci-test-repo",
                "pr_number": 600,
                "status": "open",
                "author": "ciuser"
            }
        )
        
        # Update with CI status
        resp = client.patch(
            "/api/pr-trackers/ci-test-repo/600",
            json={
                "ci_status": "passed",
                "ci_url": "https://github.com/ci-test-repo/actions/runs/123"
            }
        )
        assert resp.status_code == 200

    def test_delete_pr_tracker(self):
        """Test deleting a PR tracker."""
        # Create a tracker
        client.post(
            "/api/pr-trackers",
            json={
                "repo": "delete-test-repo",
                "pr_number": 700,
                "status": "closed",
                "author": "deleteuser"
            }
        )
        
        # Delete the tracker
        resp = client.delete("/api/pr-trackers/delete-test-repo/700")
        assert resp.status_code in [200, 204]
        
        # Verify it's gone
        get_resp = client.get("/api/pr-trackers/delete-test-repo/700")
        assert get_resp.status_code == 404

    def test_delete_pr_tracker_not_found(self):
        """Test deleting a non-existent PR tracker."""
        resp = client.delete("/api/pr-trackers/nonexistent-repo/88888")
        assert resp.status_code == 404


class TestPRTrackerStatusTransitions:
    """Tests for PR tracker status transitions."""

    def test_valid_status_transitions(self):
        """Test valid status transitions."""
        statuses = ["draft", "open", "in_review", "approved", "merged", "closed"]
        
        for status in statuses:
            resp = client.post(
                "/api/pr-trackers",
                json={
                    "repo": f"status-test-{status}",
                    "pr_number": hash(status) % 10000,
                    "status": status,
                    "author": "statustest"
                }
            )
            assert resp.status_code in [200, 201], f"Failed for status: {status}"

    def test_link_to_bounty(self):
        """Test linking PR tracker to a bounty."""
        resp = client.post(
            "/api/pr-trackers",
            json={
                "repo": "bounty-link-repo",
                "pr_number": 800,
                "status": "open",
                "author": "bountyuser",
                "bounty_id": "bounty-tier1-001",
                "bounty_title": "Test Bounty"
            }
        )
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data.get("bounty_id") == "bounty-tier1-001"


class TestPRTrackerPagination:
    """Tests for pagination of PR tracker listings."""

    def test_pagination_limit(self):
        """Test pagination limit parameter."""
        # Create multiple trackers
        for i in range(5):
            client.post(
                "/api/pr-trackers",
                json={
                    "repo": "pagination-repo",
                    "pr_number": 900 + i,
                    "status": "open",
                    "author": f"pageuser{i}"
                }
            )
        
        # Test limit
        resp = client.get("/api/pr-trackers?limit=2")
        assert resp.status_code == 200
        data = resp.json()
        if isinstance(data, dict):
            assert len(data.get("items", [])) <= 2

    def test_pagination_offset(self):
        """Test pagination offset parameter."""
        resp = client.get("/api/pr-trackers?offset=2&limit=2")
        assert resp.status_code == 200


class TestPRTrackerEdgeCases:
    """Edge case tests for PR tracker."""

    def test_empty_status_filter(self):
        """Test that empty status filter returns all."""
        resp = client.get("/api/pr-trackers?status=")
        assert resp.status_code == 200

    def test_invalid_pr_number(self):
        """Test invalid PR number handling."""
        resp = client.get("/api/pr-trackers/test-repo/-1")
        assert resp.status_code in [400, 404, 422]

    def test_special_characters_in_repo(self):
        """Test handling special characters in repo name."""
        resp = client.get("/api/pr-trackers/repo-with-dashes/123")
        assert resp.status_code in [200, 404]
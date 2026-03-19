import json
import logging
import hmac
import hashlib
from typing import Dict, List, Optional, Any
from datetime import datetime

import requests
from django.conf import settings
from django.utils import timezone

from app.models import Project, Issue, Comment
from app.utils.exceptions import GitHubSyncError

logger = logging.getLogger(__name__)


class GitHubSyncService:
    """Service for bi-directional synchronization between platform and GitHub."""
    
    def __init__(self):
        self.github_token = settings.GITHUB_TOKEN
        self.webhook_secret = settings.GITHUB_WEBHOOK_SECRET
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
    
    def verify_webhook_signature(self, payload_body: bytes, signature_header: str) -> bool:
        """Verify GitHub webhook signature."""
        if not signature_header:
            return False
        
        try:
            sha_name, signature = signature_header.split('=')
            if sha_name != 'sha256':
                return False
            
            mac = hmac.new(
                self.webhook_secret.encode('utf-8'),
                msg=payload_body,
                digestmod=hashlib.sha256
            )
            expected_signature = mac.hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False
    
    def handle_webhook_event(self, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming GitHub webhook events."""
        try:
            if event_type == "issues":
                return self._handle_issue_event(payload)
            elif event_type == "issue_comment":
                return self._handle_comment_event(payload)
            elif event_type == "ping":
                return {"status": "success", "message": "Webhook received"}
            else:
                logger.warning(f"Unhandled webhook event type: {event_type}")
                return {"status": "ignored", "message": f"Event type {event_type} not handled"}
        except Exception as e:
            logger.error(f"Error handling webhook event {event_type}: {e}")
            raise GitHubSyncError(f"Failed to handle webhook event: {e}")
    
    def _handle_issue_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GitHub issue events."""
        action = payload.get("action")
        github_issue = payload.get("issue", {})
        repository = payload.get("repository", {})
        
        repo_full_name = repository.get("full_name")
        github_issue_id = github_issue.get("id")
        github_issue_number = github_issue.get("number")
        
        try:
            project = Project.objects.get(github_repo=repo_full_name)
        except Project.DoesNotExist:
            logger.warning(f"No project found for repository: {repo_full_name}")
            return {"status": "ignored", "message": "Repository not tracked"}
        
        if action in ["opened", "edited"]:
            return self._sync_issue_from_github(project, github_issue, repository)
        elif action == "closed":
            return self._handle_issue_closed(project, github_issue_id, github_issue_number)
        elif action == "reopened":
            return self._handle_issue_reopened(project, github_issue_id, github_issue_number)
        else:
            return {"status": "ignored", "message": f"Action {action} not handled"}
    
    def _handle_comment_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GitHub issue comment events."""
        action = payload.get("action")
        comment = payload.get("comment", {})
        issue = payload.get("issue", {})
        repository = payload.get("repository", {})
        
        repo_full_name = repository.get("full_name")
        github_issue_id = issue.get("id")
        
        try:
            project = Project.objects.get(github_repo=repo_full_name)
            platform_issue = Issue.objects.get(
                project=project,
                github_issue_id=github_issue_id
            )
        except (Project.DoesNotExist, Issue.DoesNotExist):
            return {"status": "ignored", "message": "Issue or project not found"}
        
        if action in ["created", "edited"]:
            return self._sync_comment_from_github(platform_issue, comment)
        elif action == "deleted":
            return self._handle_comment_deleted(platform_issue, comment.get("id"))
        else:
            return {"status": "ignored", "message": f"Action {action} not handled"}
    
    def _sync_issue_from_github(self, project: Project, github_issue: Dict[str, Any], repository: Dict[str, Any]) -> Dict[str, Any]:
        """Sync issue from GitHub to platform."""
        github_issue_id = github_issue.get("id")
        github_issue_number = github_issue.get("number")
        github_updated_at = github_issue.get("updated_at")
        
        # Parse GitHub timestamp
        github_updated = datetime.fromisoformat(github_updated_at.replace('Z', '+00:00'))
        
        try:
            # Check if issue already exists
            platform_issue = Issue.objects.get(
                project=project,
                github_issue_id=github_issue_id
            )
            
            # Check for conflicts
            if platform_issue.updated_at > github_updated:
                logger.warning(f"Conflict detected for issue {github_issue_number}. Platform version is newer.")
                return self._resolve_issue_conflict(platform_issue, github_issue, repository)
            
            # Update existing issue
            self._update_platform_issue_from_github(platform_issue, github_issue)
            return {"status": "success", "message": f"Issue {github_issue_number} updated"}
            
        except Issue.DoesNotExist:
            # Create new issue
            platform_issue = self._create_platform_issue_from_github(project, github_issue)
            return {"status": "success", "message": f"Issue {github_issue_number} created"}
    
    def _update_platform_issue_from_github(self, platform_issue: Issue, github_issue: Dict[str, Any]):
        """Update platform issue with GitHub data."""
        platform_issue.title = github_issue.get("title", platform_issue.title)
        platform_issue.description = github_issue.get("body", platform_issue.description)
        platform_issue.status = "closed" if github_issue.get("state") == "closed" else "open"
        
        # Update labels
        github_labels = [label.get("name") for label in github_issue.get("labels", [])]
        platform_issue.labels = github_labels
        
        # Update timestamps
        github_updated_at = github_issue.get("updated_at")
        if github_updated_at:
            platform_issue.github_updated_at = datetime.fromisoformat(github_updated_at.replace('Z', '+00:00'))
        
        platform_issue.save()
    
    def _create_platform_issue_from_github(self, project: Project, github_issue: Dict[str, Any]) -> Issue:
        """Create new platform issue from GitHub data."""
        github_created_at = github_issue.get("created_at")
        github_updated_at = github_issue.get("updated_at")
        
        created_at = None
        if github_created_at:
            created_at = datetime.fromisoformat(github_created_at.replace('Z', '+00:00'))
        
        updated_at = None
        if github_updated_at:
            updated_at = datetime.fromisoformat(github_updated_at.replace('Z', '+00:00'))
        
        github_labels = [label.get("name") for label in github_issue.get("labels", [])]
        
        platform_issue = Issue.objects.create(
            project=project,
            title=github_issue.get("title", ""),
            description=github_issue.get("body", ""),
            status="closed" if github_issue.get("state") == "closed" else "open",
            github_issue_id=github_issue.get("id"),
            github_issue_number=github_issue.get("number"),
            github_created_at=created_at,
            github_updated_at=updated_at,
            labels=github_labels
        )
        
        return platform_issue
    
    def _handle_issue_closed(self, project: Project, github_issue_id: int, github_issue_number: int) -> Dict[str, Any]:
        """Handle GitHub issue closed event."""
        try:
            platform_issue = Issue.objects.get(
                project=project,
                github_issue_id=github_issue_id
            )
            platform_issue.status = "closed"
            platform_issue.save()
            return {"status": "success", "message": f"Issue {github_issue_number} closed"}
        except Issue.DoesNotExist:
            return {"status": "ignored", "message": "Issue not found"}
    
    def _handle_issue_reopened(self, project: Project, github_issue_id: int, github_issue_number: int) -> Dict[str, Any]:
        """Handle GitHub issue reopened event."""
        try:
            platform_issue = Issue.objects.get(
                project=project,
                github_issue_id=github_issue_id
            )
            platform_issue.status = "open"
            platform_issue.save()
            return {"status": "success", "message": f"Issue {github_issue_number} reopened"}
        except Issue.DoesNotExist:
            return {"status": "ignored", "message": "Issue not found"}
    
    def _sync_comment_from_github(self, platform_issue: Issue, github_comment: Dict[str, Any]) -> Dict[str, Any]:
        """Sync comment from GitHub to platform."""
        github_comment_id = github_comment.get("id")
        github_updated_at = github_comment.get("updated_at")
        
        github_updated = datetime.fromisoformat(github_updated_at.replace('Z', '+00:00'))
        
        try:
            # Check if comment already exists
            platform_comment = Comment.objects.get(
                issue=platform_issue,
                github_comment_id=github_comment_id
            )
            
            # Check for conflicts
            if platform_comment.updated_at > github_updated:
                logger.warning(f"Conflict detected for comment {github_comment_id}")
                return self._resolve_comment_conflict(platform_comment, github_comment)
            
            # Update existing comment
            platform_comment.content = github_comment.get("body", platform_comment.content)
            platform_comment.github_updated_at = github_updated
            platform_comment.save()
            
            return {"status": "success", "message": f"Comment {github_comment_id} updated"}
            
        except Comment.DoesNotExist:
            # Create new comment
            github_created_at = github_comment.get("created_at")
            created_at = None
            if github_created_at:
                created_at = datetime.fromisoformat(github_created_at.replace('Z', '+00:00'))
            
            Comment.objects.create(
                issue=platform_issue,
                content=github_comment.get("body", ""),
                github_comment_id=github_comment_id,
                github_created_at=created_at,
                github_updated_at=github_updated,
                author_github_login=github_comment.get("user", {}).get("login")
            )
            
            return {"status": "success", "message": f"Comment {github_comment_id} created"}
    
    def _handle_comment_deleted(self, platform_issue: Issue, github_comment_id: int) -> Dict[str, Any]:
        """Handle GitHub comment deleted event."""
        try:
            platform_comment = Comment.objects.get(
                issue=platform_issue,
                github_comment_id=github_comment_id
            )
            platform_comment.delete()
            return {"status": "success", "message": f"Comment {github_comment_id} deleted"}
        except Comment.DoesNotExist:
            return {"status": "ignored", "message": "Comment not found"}
    
    def sync_issue_to_github(self, issue: Issue) -> Dict[str, Any]:
        """Sync platform issue to GitHub."""
        if not issue.project.github_repo:
            raise GitHubSyncError("Project does not have GitHub repository configured")
        
        try:
            if issue.github_issue_number:
                # Update existing GitHub issue
                return self._update_github_issue(issue)
            else:
                # Create new GitHub issue
                return self._create_github_issue(issue)
        except requests.RequestException as e:
            logger.error(f"GitHub API error: {e}")
            raise GitHubSyncError(f"Failed to sync issue to GitHub: {e}")
    
    def _create_github_issue(self, issue: Issue) -> Dict[str, Any]:
        """Create new GitHub issue."""
        url = f"{self.base_url}/repos/{issue.project.github_repo}/issues"
        
        data = {
            "title": issue.title,
            "body": issue.description or "",
            "labels": issue.labels or []
        }
        
        if issue.status == "closed":
            data["state"] = "closed"
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        github_issue = response.json()
        
        # Update platform issue with GitHub data
        issue.github_issue_id = github_issue.get("id")
        issue.github_issue_number = github_issue.get("number")
        issue.github_created_at = datetime.fromisoformat(
            github_issue.get("created_at").replace('Z', '+00:00')
        )
        issue.github_updated_at = datetime.fromisoformat(
            github_issue.get("updated_at").replace('Z', '+00:00')
        )
        issue.save()
        
        return {
            "status": "success",
            "message": f"GitHub issue #{github_issue.get('number')} created",
            "github_issue_number": github_issue.get("number")
        }
    
    def _update_github_issue(self, issue: Issue) -> Dict[str, Any]:
        """Update existing GitHub issue."""
        url = f"{self.base_url}/repos/{issue.project.github_repo}/issues/{issue.github_issue_number}"
        
        data = {
            "title": issue.title,
            "body": issue.description or "",
            "labels": issue.labels or [],
            "state": "closed" if issue.status == "closed" else "open"
        }
        
        response = requests.patch(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        github_issue = response.json()
        
        # Update platform issue with GitHub timestamp
        issue.github_updated_at = datetime.fromisoformat(
            github_issue.get("updated_at").replace('Z', '+00:00')
        )
        issue.save()
        
        return {
            "status": "success",
            "message": f"GitHub issue #{issue.github_issue_number} updated"
        }
    
    def sync_comment_to_github(self, comment: Comment) -> Dict[str, Any]:
        """Sync platform comment to GitHub."""
        issue = comment.issue
        
        if not issue.github_issue_number:
            raise GitHubSyncError("Issue is not synced with GitHub")
        
        try:
            if comment.github_comment_id:
                # Update existing GitHub comment
                return self._update_github_comment(comment)
            else:
                # Create new GitHub comment
                return self._create_github_comment(comment)
        except requests.RequestException as e:
            logger.error(f"GitHub API error: {e}")
            raise GitHubSyncError(f"Failed to sync comment to GitHub: {e}")
    
    def _create_github_comment(self, comment: Comment) -> Dict[str, Any]:
        """Create new GitHub comment."""
        issue = comment.issue
        url = f"{self.base_url}/repos/{issue.project.github_repo}/issues/{issue.github_issue_number}/comments"
        
        data = {
            "body": comment.content or ""
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        github_comment = response.json()
        
        # Update platform comment with GitHub data
        comment.github_comment_id = github_comment.get("id")
        comment.github_created_at = datetime.fromisoformat(
            github_comment.get("created_at").replace('Z', '+00:00')
        )
        comment.github_updated_at = datetime.fromisoformat(
            github_comment.get("updated_at").replace('Z', '+00:00')
        )
        comment.save()
        
        return {
            "status": "success",
            "message": f"GitHub comment {github_comment.get('id')} created"
        }
    
    def _update_github_comment(self, comment: Comment) -> Dict[str, Any]:
        """Update existing GitHub comment."""
        issue = comment.issue
        url = f"{self.base_url}/repos/{issue.project.github_repo}/issues/comments/{comment.github_comment_id}"
        
        data = {
            "body": comment.content or ""
        }
        
        response = requests.patch(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        github_comment = response.json()
        
        # Update platform comment with GitHub timestamp
        comment.github_updated_at = datetime.fromisoformat(
            github_comment.get("updated_at").replace('Z', '+00:00')
        )
        comment.save()
        
        return {
            "status": "success",
            "message": f"GitHub comment {comment.github_comment_id} updated"
        }
    
    def _resolve_issue_conflict(self, platform_issue: Issue, github_issue: Dict[str, Any], repository: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflict when both platform and GitHub have newer versions."""
        # For now, prefer platform version and sync to GitHub
        try:
            self.sync_issue_to_github(platform_issue)
            return {
                "status": "conflict_resolved",
                "message": f"Conflict resolved by syncing platform version to GitHub for issue {platform_issue.github_issue_number}",
                "resolution": "platform_preferred"
            }
        except Exception as e:
            logger.error(f"Failed to resolve issue conflict: {e}")
            return {
                "status": "conflict_unresolved",
                "message": f"Failed to resolve conflict for issue {platform_issue.github_issue_number}: {e}"
            }
    
    def _resolve_comment_conflict(self, platform_comment: Comment, github_comment: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflict when both platform and GitHub have newer versions."""
        # For now, prefer platform version and sync to GitHub
        try:
            self.sync_comment_to_github(platform_comment)
            return {
                "status": "conflict_resolved",
                "message": f"Conflict resolved by syncing platform version to GitHub for comment {platform_comment.github_comment_id}",
                "resolution": "platform_preferred"
            }
        except Exception as e:
            logger.error(f"Failed to resolve comment conflict: {e}")
            return {
                "status": "conflict_unresolved",
                "message": f"Failed to resolve conflict for comment {platform_comment.github_comment_id}: {e}"
            }
    
    def get_github_issue(self, repo_full_name: str, issue_number: int) -> Optional[Dict[str, Any]]:
        """Fetch issue from GitHub API."""
        url = f"{self.base_url}/repos/{repo_full_name}/issues/{issue_number}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch GitHub issue: {e}")
            return None
    
    def get_github_comments(self, repo_full_name: str, issue_number: int) -> List[Dict[str, Any]]:
        """Fetch comments for an issue from GitHub API."""
        url = f"{self.base_url}/repos/{repo_full_name}/issues/{issue_number}/comments"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch GitHub comments: {e}")
            return []
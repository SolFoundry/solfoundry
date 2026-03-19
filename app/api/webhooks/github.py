from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
import hmac
import hashlib
import json
import logging

from app.database import get_db
from app.models.integration import Integration
from app.models.project import Project
from app.models.task import Task
from app.services.github_service import GitHubService
from app.core.config import settings

router = APIRouter(prefix="/webhooks/github", tags=["github-webhooks"])
logger = logging.getLogger(__name__)


async def verify_github_signature(request: Request, body: bytes) -> bool:
    """Verify GitHub webhook signature"""
    signature = request.headers.get("X-Hub-Signature-256")
    if not signature:
        return False
    
    expected_signature = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)


async def get_integration_by_repo(db: Session, repo_full_name: str) -> Integration:
    """Get integration by repository full name"""
    integration = db.query(Integration).filter(
        Integration.provider == "github",
        Integration.config["repository"].astext == repo_full_name
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, message="Integration not found")
    
    return integration


@router.post("/")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle GitHub webhooks for bi-directional sync"""
    try:
        body = await request.body()
        
        # Verify webhook signature
        if not await verify_github_signature(request, body):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        payload = json.loads(body)
        event_type = request.headers.get("X-GitHub-Event")
        
        # Get repository information
        repo_full_name = payload.get("repository", {}).get("full_name")
        if not repo_full_name:
            raise HTTPException(status_code=400, detail="Repository information missing")
        
        # Get integration for this repository
        integration = await get_integration_by_repo(db, repo_full_name)
        
        # Initialize GitHub service
        github_service = GitHubService(integration.access_token)
        
        # Handle different webhook events
        if event_type == "issues":
            await handle_issue_event(payload, integration, github_service, db)
        elif event_type == "pull_request":
            await handle_pull_request_event(payload, integration, github_service, db)
        elif event_type == "push":
            await handle_push_event(payload, integration, github_service, db)
        else:
            logger.info(f"Unhandled GitHub event type: {event_type}")
        
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Error processing GitHub webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def handle_issue_event(
    payload: Dict[str, Any],
    integration: Integration,
    github_service: GitHubService,
    db: Session
):
    """Handle GitHub issue events"""
    action = payload.get("action")
    issue = payload.get("issue")
    
    if not issue:
        return
    
    # Sync issue to platform
    if action in ["opened", "edited", "closed", "reopened"]:
        await sync_github_issue_to_platform(issue, integration, db)


async def handle_pull_request_event(
    payload: Dict[str, Any],
    integration: Integration,
    github_service: GitHubService,
    db: Session
):
    """Handle GitHub pull request events"""
    action = payload.get("action")
    pull_request = payload.get("pull_request")
    
    if not pull_request:
        return
    
    # Sync PR to platform
    if action in ["opened", "edited", "closed", "merged", "reopened"]:
        await sync_github_pr_to_platform(pull_request, integration, db)


async def handle_push_event(
    payload: Dict[str, Any],
    integration: Integration,
    github_service: GitHubService,
    db: Session
):
    """Handle GitHub push events"""
    commits = payload.get("commits", [])
    
    for commit in commits:
        await sync_github_commit_to_platform(commit, integration, db)


async def sync_github_issue_to_platform(
    issue: Dict[str, Any],
    integration: Integration,
    db: Session
):
    """Sync GitHub issue to platform task"""
    # Check if task already exists
    existing_task = db.query(Task).filter(
        Task.external_id == str(issue["id"]),
        Task.integration_id == integration.id
    ).first()
    
    task_data = {
        "title": issue["title"],
        "description": issue.get("body", ""),
        "status": "completed" if issue["state"] == "closed" else "in_progress",
        "external_id": str(issue["id"]),
        "external_url": issue["html_url"],
        "integration_id": integration.id,
        "project_id": integration.project_id
    }
    
    if existing_task:
        # Update existing task
        for key, value in task_data.items():
            setattr(existing_task, key, value)
    else:
        # Create new task
        new_task = Task(**task_data)
        db.add(new_task)
    
    db.commit()


async def sync_github_pr_to_platform(
    pull_request: Dict[str, Any],
    integration: Integration,
    db: Session
):
    """Sync GitHub pull request to platform task"""
    # Similar to issue sync but for PRs
    existing_task = db.query(Task).filter(
        Task.external_id == f"pr-{pull_request['id']}",
        Task.integration_id == integration.id
    ).first()
    
    task_data = {
        "title": f"PR: {pull_request['title']}",
        "description": pull_request.get("body", ""),
        "status": "completed" if pull_request["state"] == "closed" else "in_progress",
        "external_id": f"pr-{pull_request['id']}",
        "external_url": pull_request["html_url"],
        "integration_id": integration.id,
        "project_id": integration.project_id
    }
    
    if existing_task:
        for key, value in task_data.items():
            setattr(existing_task, key, value)
    else:
        new_task = Task(**task_data)
        db.add(new_task)
    
    db.commit()


async def sync_github_commit_to_platform(
    commit: Dict[str, Any],
    integration: Integration,
    db: Session
):
    """Sync GitHub commit to platform"""
    # Create or update commit record
    logger.info(f"Syncing commit {commit['id']} to platform")
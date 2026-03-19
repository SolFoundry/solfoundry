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


async def get_integration_by_repo(
    repo_full_name: str, 
    db: Session = Depends(get_db)
) -> Integration:
    """Get integration by repository full name"""
    integration = db.query(Integration).filter(
        Integration.provider == "github",
        Integration.config["repository"].astext == repo_full_name
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=404, 
            detail=f"No integration found for repository {repo_full_name}"
        )
    
    return integration


@router.post("/")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle GitHub webhook events"""
    body = await request.body()
    
    # Verify signature
    if not await verify_github_signature(request, body):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Parse payload
    try:
        payload = json.loads(body.decode())
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    event_type = request.headers.get("X-GitHub-Event")
    if not event_type:
        raise HTTPException(status_code=400, detail="Missing event type header")
    
    logger.info(f"Received GitHub webhook: {event_type}")
    
    # Route to appropriate handler
    if event_type == "issues":
        return await handle_issues_event(payload, db)
    elif event_type == "issue_comment":
        return await handle_issue_comment_event(payload, db)
    elif event_type == "pull_request":
        return await handle_pull_request_event(payload, db)
    else:
        logger.info(f"Unhandled event type: {event_type}")
        return {"status": "ignored", "event": event_type}


async def handle_issues_event(payload: Dict[str, Any], db: Session):
    """Handle GitHub issues events"""
    action = payload.get("action")
    issue = payload.get("issue", {})
    repository = payload.get("repository", {})
    
    repo_full_name = repository.get("full_name")
    if not repo_full_name:
        raise HTTPException(status_code=400, detail="Missing repository information")
    
    integration = await get_integration_by_repo(repo_full_name, db)
    project = integration.project
    
    github_service = GitHubService(integration.credentials)
    
    if action == "opened":
        return await handle_issue_created(issue, project, github_service, db)
    elif action == "closed":
        return await handle_issue_closed(issue, project, db)
    elif action == "labeled" or action == "unlabeled":
        return await handle_issue_labeled(issue, project, db)
    elif action == "edited":
        return await handle_issue_edited(issue, project, db)
    else:
        return {"status": "ignored", "action": action}


async def handle_issue_created(
    issue: Dict[str, Any], 
    project: Project, 
    github_service: GitHubService,
    db: Session
):
    """Handle new issue creation"""
    issue_number = issue.get("number")
    title = issue.get("title", "")
    body = issue.get("body", "")
    labels = [label["name"] for label in issue.get("labels", [])]
    
    # Check if task already exists
    existing_task = db.query(Task).filter(
        Task.project_id == project.id,
        Task.external_id == str(issue_number)
    ).first()
    
    if existing_task:
        logger.info(f"Task already exists for issue #{issue_number}")
        return {"status": "exists", "task_id": existing_task.id}
    
    # Determine task type and bounty amount from labels
    task_type = "feature"
    bounty_amount = None
    
    for label in labels:
        if label.lower().startswith("bounty:"):
            try:
                bounty_amount = int(label.split(":")[1].strip().replace("$", ""))
            except (ValueError, IndexError):
                pass
        elif label.lower() in ["bug", "enhancement", "feature"]:
            task_type = label.lower()
    
    # Create new task
    new_task = Task(
        title=title,
        description=body,
        project_id=project.id,
        task_type=task_type,
        status="open",
        bounty_amount=bounty_amount,
        external_id=str(issue_number),
        external_url=issue.get("html_url"),
        metadata={
            "github_issue_id": issue.get("id"),
            "github_number": issue_number,
            "labels": labels,
            "created_via": "github_webhook"
        }
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    logger.info(f"Created task {new_task.id} from GitHub issue #{issue_number}")
    
    return {
        "status": "created",
        "task_id": new_task.id,
        "issue_number": issue_number
    }


async def handle_issue_closed(
    issue: Dict[str, Any], 
    project: Project, 
    db: Session
):
    """Handle issue closure"""
    issue_number = issue.get("number")
    
    task = db.query(Task).filter(
        Task.project_id == project.id,
        Task.external_id == str(issue_number)
    ).first()
    
    if not task:
        return {"status": "not_found", "issue_number": issue_number}
    
    # Update task status
    task.status = "completed" if issue.get("state") == "closed" else task.status
    task.metadata = {
        **(task.metadata or {}),
        "closed_at": issue.get("closed_at"),
        "closed_by": issue.get("closed_by", {}).get("login")
    }
    
    db.commit()
    
    logger.info(f"Updated task {task.id} status to closed from GitHub issue #{issue_number}")
    
    return {
        "status": "updated",
        "task_id": task.id,
        "issue_number": issue_number
    }


async def handle_issue_labeled(
    issue: Dict[str, Any], 
    project: Project, 
    db: Session
):
    """Handle issue labeling changes"""
    issue_number = issue.get("number")
    labels = [label["name"] for label in issue.get("labels", [])]
    
    task = db.query(Task).filter(
        Task.project_id == project.id,
        Task.external_id == str(issue_number)
    ).first()
    
    if not task:
        return {"status": "not_found", "issue_number": issue_number}
    
    # Update bounty amount from labels
    bounty_amount = None
    task_type = task.task_type
    
    for label in labels:
        if label.lower().startswith("bounty:"):
            try:
                bounty_amount = int(label.split(":")[1].strip().replace("$", ""))
            except (ValueError, IndexError):
                pass
        elif label.lower() in ["bug", "enhancement", "feature"]:
            task_type = label.lower()
    
    task.bounty_amount = bounty_amount
    task.task_type = task_type
    task.metadata = {
        **(task.metadata or {}),
        "labels": labels
    }
    
    db.commit()
    
    logger.info(f"Updated task {task.id} labels from GitHub issue #{issue_number}")
    
    return {
        "status": "updated",
        "task_id": task.id,
        "issue_number": issue_number,
        "bounty_amount": bounty_amount
    }


async def handle_issue_edited(
    issue: Dict[str, Any], 
    project: Project, 
    db: Session
):
    """Handle issue edit events"""
    issue_number = issue.get("number")
    
    task = db.query(Task).filter(
        Task.project_id == project.id,
        Task.external_id == str(issue_number)
    ).first()
    
    if not task:
        return {"status": "not_found", "issue_number": issue_number}
    
    # Update task details
    task.title = issue.get("title", task.title)
    task.description = issue.get("body", task.description)
    
    db.commit()
    
    logger.info(f"Updated task {task.id} content from GitHub issue #{issue_number}")
    
    return {
        "status": "updated",
        "task_id": task.id,
        "issue_number": issue_number
    }


async def handle_issue_comment_event(payload: Dict[str, Any], db: Session):
    """Handle GitHub issue comment events"""
    action = payload.get("action")
    comment = payload.get("comment", {})
    issue = payload.get("issue", {})
    repository = payload.get("repository", {})
    
    if action != "created":
        return {"status": "ignored", "action": action}
    
    repo_full_name = repository.get("full_name")
    integration = await get_integration_by_repo(repo_full_name, db)
    
    issue_number = issue.get("number")
    task = db.query(Task).filter(
        Task.project_id == integration.project.id,
        Task.external_id == str(issue_number)
    ).first()
    
    if not task:
        return {"status": "task_not_found", "issue_number": issue_number}
    
    # Add comment to task metadata
    comments = task.metadata.get("comments", []) if task.metadata else []
    comments.append({
        "id": comment.get("id"),
        "author": comment.get("user", {}).get("login"),
        "body": comment.get("body"),
        "created_at": comment.get("created_at"),
        "html_url": comment.get("html_url")
    })
    
    task.metadata = {
        **(task.metadata or {}),
        "comments": comments
    }
    
    db.commit()
    
    return {
        "status": "comment_added",
        "task_id": task.id,
        "issue_number": issue_number
    }


async def handle_pull_request_event(payload: Dict[str, Any], db: Session):
    """Handle GitHub pull request events"""
    action = payload.get("action")
    pull_request = payload.get("pull_request", {})
    repository = payload.get("repository", {})
    
    # Only handle PR events that reference issues
    if action not in ["opened", "closed"]:
        return {"status": "ignored", "action": action}
    
    repo_full_name = repository.get("full_name")
    integration = await get_integration_by_repo(repo_full_name, db)
    
    # Extract issue references from PR body
    pr_body = pull_request.get("body", "")
    issue_refs = extract_issue_references(pr_body)
    
    if not issue_refs:
        return {"status": "no_issue_references"}
    
    updated_tasks = []
    for issue_number in issue_refs:
        task = db.query(Task).filter(
            Task.project_id == integration.project.id,
            Task.external_id == str(issue_number)
        ).first()
        
        if task:
            pr_info = {
                "number": pull_request.get("number"),
                "title": pull_request.get("title"),
                "html_url": pull_request.get("html_url"),
                "state": pull_request.get("state"),
                "merged": pull_request.get("merged", False)
            }
            
            pull_requests = task.metadata.get("pull_requests", []) if task.metadata else []
            
            # Update existing PR or add new one
            existing_pr = next((pr for pr in pull_requests if pr["number"] == pr_info["number"]), None)
            if existing_pr:
                existing_pr.update(pr_info)
            else:
                pull_requests.append(pr_info)
            
            task.metadata = {
                **(task.metadata or {}),
                "pull_requests": pull_requests
            }
            
            # Update task status if PR is merged
            if action == "closed" and pull_request.get("merged"):
                task.status = "in_review"
            
            updated_tasks.append(task.id)
    
    db.commit()
    
    return {
        "status": "updated",
        "updated_tasks": updated_tasks,
        "pr_number": pull_request.get("number")
    }


def extract_issue_references(text: str) -> list[int]:
    """Extract issue number references from text (e.g., 'fixes #123', 'closes #456')"""
    import re
    
    patterns = [
        r'(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s*#(\d+)',
        r'#(\d+)'
    ]
    
    issue_numbers = []
    for pattern in patterns:
        matches = re.findall(pattern, text.lower())
        issue_numbers.extend([int(match) for match in matches])
    
    return list(set(issue_numbers))  # Remove duplicates
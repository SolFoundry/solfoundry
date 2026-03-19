from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import JSONResponse
import hashlib
import hmac
import json
from typing import Optional
from app.core.config import settings
from app.models.bounty import Bounty
from app.database import get_database
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def verify_github_signature(payload: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature using HMAC-SHA256"""
    if not signature:
        return False
    
    try:
        # Remove 'sha256=' prefix
        signature = signature.replace('sha256=', '')
        
        # Calculate expected signature
        expected = hmac.new(
            settings.GITHUB_WEBHOOK_SECRET.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected)
    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False

async def handle_pull_request_event(payload: dict):
    """Handle pull request events for bounty updates"""
    action = payload.get('action')
    pr = payload.get('pull_request', {})
    repository = payload.get('repository', {})
    
    repo_full_name = repository.get('full_name')
    pr_number = pr.get('number')
    pr_url = pr.get('html_url')
    pr_title = pr.get('title', '')
    pr_body = pr.get('body', '')
    pr_state = pr.get('state')
    merged = pr.get('merged', False)
    
    # Extract bounty references from PR title or body
    bounty_refs = extract_bounty_references(pr_title + ' ' + pr_body)
    
    db = get_database()
    
    for bounty_ref in bounty_refs:
        try:
            bounty = await db.bounties.find_one({
                "repository": repo_full_name,
                "$or": [
                    {"issue_number": bounty_ref},
                    {"_id": bounty_ref}
                ]
            })
            
            if not bounty:
                continue
                
            update_data = {}
            
            if action == 'opened':
                # Add PR to bounty submissions
                update_data["$addToSet"] = {
                    "submissions": {
                        "pr_number": pr_number,
                        "pr_url": pr_url,
                        "author": pr.get('user', {}).get('login'),
                        "status": "submitted",
                        "created_at": pr.get('created_at')
                    }
                }
                
            elif action == 'closed' and merged:
                # Update bounty status if PR is merged
                update_data["$set"] = {
                    "status": "completed",
                    "completed_at": pr.get('merged_at'),
                    "winner": pr.get('user', {}).get('login')
                }
                
                # Update submission status
                update_data["$set"]["submissions.$[elem].status"] = "accepted"
                
            elif action == 'closed' and not merged:
                # Update submission status if PR is closed without merge
                update_data["$set"] = {"submissions.$[elem].status": "rejected"}
                
            if update_data:
                filter_query = {"_id": bounty["_id"]}
                array_filters = [{"elem.pr_number": pr_number}] if "submissions.$[elem]" in str(update_data) else None
                
                await db.bounties.update_one(
                    filter_query,
                    update_data,
                    array_filters=array_filters
                )
                
                logger.info(f"Updated bounty {bounty['_id']} for PR #{pr_number}")
                
        except Exception as e:
            logger.error(f"Error handling PR event for bounty {bounty_ref}: {e}")

async def handle_issues_event(payload: dict):
    """Handle issue events for bounty management"""
    action = payload.get('action')
    issue = payload.get('issue', {})
    repository = payload.get('repository', {})
    
    repo_full_name = repository.get('full_name')
    issue_number = issue.get('number')
    issue_title = issue.get('title', '')
    issue_body = issue.get('body', '')
    issue_state = issue.get('state')
    
    db = get_database()
    
    try:
        # Find existing bounty for this issue
        bounty = await db.bounties.find_one({
            "repository": repo_full_name,
            "issue_number": issue_number
        })
        
        if action == 'closed' and bounty:
            # Close bounty if issue is closed without completion
            if bounty.get('status') not in ['completed', 'paid']:
                await db.bounties.update_one(
                    {"_id": bounty["_id"]},
                    {
                        "$set": {
                            "status": "cancelled",
                            "cancelled_at": issue.get('closed_at')
                        }
                    }
                )
                logger.info(f"Cancelled bounty {bounty['_id']} - issue closed")
                
        elif action == 'reopened' and bounty:
            # Reopen bounty if issue is reopened
            if bounty.get('status') == 'cancelled':
                await db.bounties.update_one(
                    {"_id": bounty["_id"]},
                    {
                        "$set": {
                            "status": "open",
                            "cancelled_at": None
                        }
                    }
                )
                logger.info(f"Reopened bounty {bounty['_id']} - issue reopened")
                
        elif action in ['opened', 'edited']:
            # Check for bounty creation commands in issue body
            if has_bounty_command(issue_body) and not bounty:
                # Create new bounty (this would typically trigger other systems)
                logger.info(f"Bounty creation detected for issue #{issue_number} in {repo_full_name}")
                
    except Exception as e:
        logger.error(f"Error handling issue event for {repo_full_name}#{issue_number}: {e}")

def extract_bounty_references(text: str) -> list:
    """Extract bounty references from text (issue numbers, bounty IDs)"""
    import re
    
    references = []
    
    # Extract issue references like #123
    issue_pattern = r'#(\d+)'
    issue_matches = re.findall(issue_pattern, text)
    references.extend([int(match) for match in issue_matches])
    
    # Extract bounty ID references
    bounty_pattern = r'bounty[:\s]+([a-f0-9]{24})'
    bounty_matches = re.findall(bounty_pattern, text.lower())
    references.extend(bounty_matches)
    
    return list(set(references))  # Remove duplicates

def has_bounty_command(text: str) -> bool:
    """Check if text contains bounty creation commands"""
    if not text:
        return False
    
    bounty_keywords = [
        '/bounty',
        'create bounty',
        'add bounty',
        'bounty:'
    ]
    
    return any(keyword in text.lower() for keyword in bounty_keywords)

@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """GitHub webhook endpoint"""
    
    # Get raw payload
    payload = await request.body()
    
    # Verify signature
    if not verify_github_signature(payload, x_hub_signature_256 or ""):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    try:
        # Parse JSON payload
        event_data = json.loads(payload.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    logger.info(f"Received GitHub webhook: {x_github_event}")
    
    try:
        # Route event to appropriate handler
        if x_github_event == "pull_request":
            await handle_pull_request_event(event_data)
        elif x_github_event == "issues":
            await handle_issues_event(event_data)
        elif x_github_event == "ping":
            # Respond to ping events
            logger.info("GitHub webhook ping received")
        else:
            logger.info(f"Unhandled GitHub event: {x_github_event}")
            
    except Exception as e:
        logger.error(f"Error processing webhook event {x_github_event}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
    return JSONResponse(
        content={"message": "Webhook processed successfully"},
        status_code=200
    )

@router.get("/github/health")
async def webhook_health():
    """Health check endpoint for webhook service"""
    return {"status": "healthy", "service": "github-webhooks"}
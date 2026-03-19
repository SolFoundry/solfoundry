import logging
from datetime import datetime, timedelta
from celery import shared_task
from app.models import User, Project, Bounty
from app.extensions import db
from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)

@shared_task
def check_expired_claims():
    """
    Check for expired bounty claims and auto-release them.
    Runs every hour to find claims that have exceeded their deadline.
    """
    try:
        logger.info("Starting expired claims check")
        
        # Find all bounties with active claims that have expired
        now = datetime.utcnow()
        expired_claims = db.session.query(Bounty).filter(
            Bounty.status == 'claimed',
            Bounty.claim_deadline < now,
            Bounty.claimed_by.isnot(None)
        ).all()
        
        if not expired_claims:
            logger.info("No expired claims found")
            return {"released_count": 0}
        
        released_count = 0
        github_service = GitHubService()
        
        for bounty in expired_claims:
            try:
                # Get the user who claimed the bounty
                claimed_user = db.session.query(User).filter_by(id=bounty.claimed_by).first()
                
                # Auto-release the bounty
                bounty.status = 'available'
                bounty.claimed_by = None
                bounty.claim_deadline = None
                bounty.updated_at = now
                
                # Post GitHub comment about auto-release
                if bounty.github_issue_url and claimed_user:
                    try:
                        # Extract owner, repo, and issue number from GitHub URL
                        url_parts = bounty.github_issue_url.replace('https://github.com/', '').split('/')
                        if len(url_parts) >= 4 and url_parts[2] == 'issues':
                            owner = url_parts[0]
                            repo = url_parts[1]
                            issue_number = int(url_parts[3])
                            
                            comment_body = (
                                f"🔄 **Bounty Auto-Released**\n\n"
                                f"The claim by @{claimed_user.github_username} has expired and the bounty "
                                f"has been automatically released back to the pool.\n\n"
                                f"💰 **Bounty Value**: {bounty.amount} {bounty.token_symbol}\n"
                                f"⏰ **Claim Deadline**: {bounty.claim_deadline.strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
                                f"The bounty is now available for claiming again. "
                                f"Visit the bounty platform to claim it!"
                            )
                            
                            github_service.post_comment(owner, repo, issue_number, comment_body)
                            logger.info(f"Posted auto-release comment for bounty {bounty.id}")
                            
                    except Exception as e:
                        logger.error(f"Failed to post GitHub comment for bounty {bounty.id}: {str(e)}")
                
                released_count += 1
                logger.info(f"Auto-released expired bounty {bounty.id} from user {claimed_user.username if claimed_user else 'unknown'}")
                
            except Exception as e:
                logger.error(f"Failed to auto-release bounty {bounty.id}: {str(e)}")
                continue
        
        # Commit all changes
        db.session.commit()
        
        logger.info(f"Expired claims check completed. Released {released_count} bounties")
        return {"released_count": released_count}
        
    except Exception as e:
        logger.error(f"Error in check_expired_claims task: {str(e)}")
        db.session.rollback()
        raise

@shared_task
def send_claim_deadline_reminders():
    """
    Send reminders to users whose bounty claims are approaching deadline.
    Runs every hour to check for claims expiring within 24 hours.
    """
    try:
        logger.info("Starting claim deadline reminders check")
        
        # Find claims expiring within 24 hours
        now = datetime.utcnow()
        reminder_threshold = now + timedelta(hours=24)
        
        approaching_deadline = db.session.query(Bounty).filter(
            Bounty.status == 'claimed',
            Bounty.claim_deadline > now,
            Bounty.claim_deadline <= reminder_threshold,
            Bounty.claimed_by.isnot(None)
        ).all()
        
        if not approaching_deadline:
            logger.info("No approaching deadlines found")
            return {"reminders_sent": 0}
        
        reminders_sent = 0
        github_service = GitHubService()
        
        for bounty in approaching_deadline:
            try:
                claimed_user = db.session.query(User).filter_by(id=bounty.claimed_by).first()
                
                if bounty.github_issue_url and claimed_user:
                    # Extract GitHub info
                    url_parts = bounty.github_issue_url.replace('https://github.com/', '').split('/')
                    if len(url_parts) >= 4 and url_parts[2] == 'issues':
                        owner = url_parts[0]
                        repo = url_parts[1]
                        issue_number = int(url_parts[3])
                        
                        hours_remaining = int((bounty.claim_deadline - now).total_seconds() / 3600)
                        
                        comment_body = (
                            f"⚠️ **Claim Deadline Reminder**\n\n"
                            f"Hi @{claimed_user.github_username}! Your claim on this bounty is approaching its deadline.\n\n"
                            f"💰 **Bounty Value**: {bounty.amount} {bounty.token_symbol}\n"
                            f"⏰ **Time Remaining**: ~{hours_remaining} hours\n"
                            f"📅 **Deadline**: {bounty.claim_deadline.strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
                            f"Please submit your solution soon to avoid auto-release of the claim!"
                        )
                        
                        github_service.post_comment(owner, repo, issue_number, comment_body)
                        reminders_sent += 1
                        logger.info(f"Sent deadline reminder for bounty {bounty.id}")
                        
            except Exception as e:
                logger.error(f"Failed to send reminder for bounty {bounty.id}: {str(e)}")
                continue
        
        logger.info(f"Deadline reminders completed. Sent {reminders_sent} reminders")
        return {"reminders_sent": reminders_sent}
        
    except Exception as e:
        logger.error(f"Error in send_claim_deadline_reminders task: {str(e)}")
        raise
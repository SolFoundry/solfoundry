from celery import Celery
from datetime import datetime, timedelta
from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.bounty import Bounty
from app.models.claim import Claim
from app.services.github_service import GitHubService
import logging

logger = logging.getLogger(__name__)

celery = Celery('bounty_watcher')

Session = sessionmaker(bind=engine)

@celery.task
def check_expired_claims():
    """Check for expired claims and auto-release them with GitHub bot comments."""
    session = Session()
    try:
        # Find claims that have expired (older than 24 hours and still active)
        expiry_threshold = datetime.utcnow() - timedelta(hours=24)
        expired_claims = session.query(Claim).filter(
            Claim.status == 'active',
            Claim.created_at < expiry_threshold
        ).all()
        
        github_service = GitHubService()
        
        for claim in expired_claims:
            try:
                # Update claim status to expired
                claim.status = 'expired'
                claim.expired_at = datetime.utcnow()
                
                # Update bounty status back to open
                bounty = session.query(Bounty).filter(
                    Bounty.id == claim.bounty_id
                ).first()
                
                if bounty:
                    bounty.status = 'open'
                    bounty.assignee = None
                    
                    # Post GitHub comment about auto-release
                    comment_body = f"""🤖 **Bounty Auto-Released**

@{claim.claimant} Your claim on this bounty has expired after 24 hours of inactivity.

The bounty is now available for others to claim.

**Bounty Details:**
- Amount: {bounty.amount} {bounty.token}
- Status: Open
- Next steps: Anyone can now claim this bounty

*This is an automated message from the bounty system.*"""
                    
                    github_service.post_comment(
                        repo_owner=bounty.repo_owner,
                        repo_name=bounty.repo_name,
                        issue_number=bounty.issue_number,
                        comment_body=comment_body
                    )
                    
                    logger.info(f"Auto-released expired claim {claim.id} for bounty {bounty.id}")
                
            except Exception as e:
                logger.error(f"Error processing expired claim {claim.id}: {str(e)}")
                continue
        
        session.commit()
        logger.info(f"Processed {len(expired_claims)} expired claims")
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error in check_expired_claims: {str(e)}")
        raise
    finally:
        session.close()

@celery.task
def check_stale_bounties():
    """Check for bounties that have been open for too long and notify."""
    session = Session()
    try:
        # Find bounties open for more than 7 days
        stale_threshold = datetime.utcnow() - timedelta(days=7)
        stale_bounties = session.query(Bounty).filter(
            Bounty.status == 'open',
            Bounty.created_at < stale_threshold
        ).all()
        
        github_service = GitHubService()
        
        for bounty in stale_bounties:
            try:
                # Only notify once per week
                last_notification = getattr(bounty, 'last_stale_notification', None)
                if last_notification and datetime.utcnow() - last_notification < timedelta(days=7):
                    continue
                
                comment_body = f"""📅 **Stale Bounty Reminder**

This bounty has been open for over 7 days without being claimed.

**Bounty Details:**
- Amount: {bounty.amount} {bounty.token}
- Created: {bounty.created_at.strftime('%Y-%m-%d')}
- Status: Open for claims

Consider reviewing if this bounty is still relevant or if the requirements need clarification.

*This is an automated reminder from the bounty system.*"""
                
                github_service.post_comment(
                    repo_owner=bounty.repo_owner,
                    repo_name=bounty.repo_name,
                    issue_number=bounty.issue_number,
                    comment_body=comment_body
                )
                
                # Update last notification time
                bounty.last_stale_notification = datetime.utcnow()
                logger.info(f"Posted stale bounty notification for bounty {bounty.id}")
                
            except Exception as e:
                logger.error(f"Error processing stale bounty {bounty.id}: {str(e)}")
                continue
        
        session.commit()
        logger.info(f"Processed {len(stale_bounties)} stale bounties")
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error in check_stale_bounties: {str(e)}")
        raise
    finally:
        session.close()

# Schedule tasks
celery.conf.beat_schedule = {
    'check-expired-claims': {
        'task': 'app.tasks.bounty_watcher.check_expired_claims',
        'schedule': 3600.0,  # Run every hour
    },
    'check-stale-bounties': {
        'task': 'app.tasks.bounty_watcher.check_stale_bounties',
        'schedule': 86400.0,  # Run every 24 hours
    },
}

celery.conf.timezone = 'UTC'
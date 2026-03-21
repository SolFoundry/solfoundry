import os
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from celery import Celery
from celery.exceptions import Retry
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.database import Submission, Bounty, User
from app.core.logger import get_logger

logger = get_logger(__name__)

# Celery app configuration
celery_app = Celery(
    'review_monitor',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Database session
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class GitHubAPIError(Exception):
    """Custom exception for GitHub API errors"""
    pass

class ReviewMonitor:
    def __init__(self):
        self.github_token = settings.GITHUB_TOKEN
        self.headers = {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SolFoundry-ReviewMonitor/1.0'
        }
        self.base_url = 'https://api.github.com'

    def get_workflow_runs(self, repo_full_name: str, pr_number: int) -> List[Dict[str, Any]]:
        """Fetch workflow runs for a specific PR"""
        url = f"{self.base_url}/repos/{repo_full_name}/actions/runs"
        params = {
            'event': 'pull_request',
            'status': 'completed',
            'per_page': 100
        }

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()

            runs = response.json().get('workflow_runs', [])
            # Filter runs for the specific PR
            pr_runs = []
            for run in runs:
                if (run.get('pull_requests') and
                    any(pr.get('number') == pr_number for pr in run['pull_requests'])):
                    pr_runs.append(run)

            return pr_runs
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch workflow runs for {repo_full_name} PR #{pr_number}: {e}")
            raise GitHubAPIError(f"GitHub API error: {e}")

    def get_workflow_artifacts(self, repo_full_name: str, run_id: int) -> Optional[Dict[str, Any]]:
        """Fetch artifacts from a completed workflow run"""
        url = f"{self.base_url}/repos/{repo_full_name}/actions/runs/{run_id}/artifacts"

        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch artifacts for run {run_id}: {e}")
            raise GitHubAPIError(f"GitHub API error: {e}")

    def download_artifact_content(self, artifact_url: str) -> Optional[Dict[str, Any]]:
        """Download and parse artifact content containing review scores"""
        try:
            response = requests.get(artifact_url, headers=self.headers)
            response.raise_for_status()

            # Parse the artifact content (assuming JSON format)
            content = response.json()
            return content
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logger.error(f"Failed to download/parse artifact: {e}")
            return None

    def parse_review_scores(self, artifact_content: Dict[str, Any]) -> Dict[str, float]:
        """Extract review scores from artifact content"""
        scores = {}

        # Expected structure from Multi-LLM pipeline
        if 'review_results' in artifact_content:
            results = artifact_content['review_results']

            # Extract individual model scores
            if 'gpt_score' in results:
                scores['gpt'] = float(results['gpt_score'])
            if 'gemini_score' in results:
                scores['gemini'] = float(results['gemini_score'])
            if 'grok_score' in results:
                scores['grok'] = float(results['grok_score'])

            # Calculate overall score
            if scores:
                scores['overall'] = sum(scores.values()) / len(scores)

        return scores

@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def monitor_pr_reviews(self, submission_id: int):
    """Monitor GitHub Actions for completed PR reviews"""
    monitor = ReviewMonitor()
    db = SessionLocal()

    try:
        # Get submission details
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            logger.error(f"Submission {submission_id} not found")
            return

        if submission.status not in ['under_review', 'pending']:
            logger.info(f"Submission {submission_id} status is {submission.status}, skipping")
            return

        # Parse PR URL to get repo and PR number
        pr_url = submission.pr_url
        if not pr_url or 'github.com' not in pr_url:
            logger.error(f"Invalid PR URL for submission {submission_id}: {pr_url}")
            return

        # Extract repo and PR number from URL
        # URL format: https://github.com/owner/repo/pull/123
        url_parts = pr_url.replace('https://github.com/', '').split('/')
        if len(url_parts) < 4:
            logger.error(f"Cannot parse PR URL: {pr_url}")
            return

        repo_full_name = f"{url_parts[0]}/{url_parts[1]}"
        pr_number = int(url_parts[3])

        # Get workflow runs for this PR
        workflow_runs = monitor.get_workflow_runs(repo_full_name, pr_number)

        review_found = False
        latest_scores = {}

        for run in workflow_runs:
            # Look for review workflow (assuming workflow name contains 'review' or 'multi-llm')
            workflow_name = run.get('name', '').lower()
            if 'review' not in workflow_name and 'multi-llm' not in workflow_name:
                continue

            # Check if run is completed successfully
            if run.get('status') == 'completed' and run.get('conclusion') == 'success':
                # Get artifacts from this run
                artifacts = monitor.get_workflow_artifacts(repo_full_name, run['id'])

                if artifacts and artifacts.get('artifacts'):
                    for artifact in artifacts['artifacts']:
                        # Look for review results artifact
                        if 'review' in artifact.get('name', '').lower():
                            artifact_content = monitor.download_artifact_content(
                                artifact['archive_download_url']
                            )

                            if artifact_content:
                                scores = monitor.parse_review_scores(artifact_content)
                                if scores:
                                    latest_scores = scores
                                    review_found = True
                                    break

                if review_found:
                    break

        if review_found and latest_scores:
            # Update submission with review scores
            submission.gpt_score = latest_scores.get('gpt')
            submission.gemini_score = latest_scores.get('gemini')
            submission.grok_score = latest_scores.get('grok')
            submission.overall_score = latest_scores.get('overall')
            submission.review_completed_at = datetime.utcnow()
            submission.status = 'reviewed'

            # Check if auto-approval threshold is met
            overall_score = latest_scores.get('overall', 0)
            if overall_score >= 7.0:  # Auto-approval threshold
                submission.status = 'approved'
                submission.approved_at = datetime.utcnow()
                logger.info(f"Auto-approved submission {submission_id} with score {overall_score}")

                # Schedule payout task
                schedule_payout.delay(submission_id)

            db.commit()
            logger.info(f"Updated submission {submission_id} with scores: {latest_scores}")

            # Notify bounty creator
            notify_creator_review_complete.delay(submission_id)

        else:
            # Check if 48 hours have passed since submission
            time_since_submission = datetime.utcnow() - submission.created_at
            if time_since_submission > timedelta(hours=48):
                # Auto-approve after timeout
                submission.status = 'approved'
                submission.approved_at = datetime.utcnow()
                submission.auto_approved = True
                db.commit()

                logger.info(f"Auto-approved submission {submission_id} after 48h timeout")
                schedule_payout.delay(submission_id)
            else:
                # Retry monitoring
                logger.info(f"No review found for submission {submission_id}, will retry")
                raise self.retry(countdown=600)  # Retry in 10 minutes

    except GitHubAPIError as e:
        logger.error(f"GitHub API error monitoring submission {submission_id}: {e}")
        # Exponential backoff for API errors
        raise self.retry(countdown=min(300 * (2 ** self.request.retries), 3600))

    except Exception as e:
        logger.error(f"Error monitoring submission {submission_id}: {e}")
        raise

    finally:
        db.close()

@celery_app.task(bind=True, max_retries=2)
def schedule_payout(self, submission_id: int):
    """Schedule payout for approved submission"""
    db = SessionLocal()

    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            logger.error(f"Submission {submission_id} not found for payout")
            return

        bounty = db.query(Bounty).filter(Bounty.id == submission.bounty_id).first()
        if not bounty:
            logger.error(f"Bounty {submission.bounty_id} not found")
            return

        # Update bounty status
        bounty.status = 'completed'
        bounty.winner_id = submission.user_id
        bounty.completed_at = datetime.utcnow()

        # Mark submission as paid (actual payment logic would go here)
        submission.status = 'paid'
        submission.paid_at = datetime.utcnow()

        db.commit()

        logger.info(f"Scheduled payout for submission {submission_id}, bounty {bounty.id}")

        # Send notification to winner
        notify_winner_payout.delay(submission_id)

    except Exception as e:
        logger.error(f"Error scheduling payout for submission {submission_id}: {e}")
        raise

    finally:
        db.close()

@celery_app.task
def notify_creator_review_complete(submission_id: int):
    """Notify bounty creator that review is complete"""
    db = SessionLocal()

    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            return

        bounty = db.query(Bounty).filter(Bounty.id == submission.bounty_id).first()
        creator = db.query(User).filter(User.id == bounty.creator_id).first()

        if creator and creator.email:
            # Send email notification (implementation would depend on email service)
            logger.info(f"Would notify {creator.email} about review completion for submission {submission_id}")

    except Exception as e:
        logger.error(f"Error notifying creator for submission {submission_id}: {e}")

    finally:
        db.close()

@celery_app.task
def notify_winner_payout(submission_id: int):
    """Notify winner about payout"""
    db = SessionLocal()

    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            return

        winner = db.query(User).filter(User.id == submission.user_id).first()

        if winner and winner.email:
            logger.info(f"Would notify {winner.email} about payout for submission {submission_id}")

    except Exception as e:
        logger.error(f"Error notifying winner for submission {submission_id}: {e}")

    finally:
        db.close()

@celery_app.task
def start_review_monitoring(submission_id: int):
    """Start monitoring a new submission"""
    logger.info(f"Starting review monitoring for submission {submission_id}")
    monitor_pr_reviews.delay(submission_id)

# Periodic task to check for stale submissions
@celery_app.task
def check_stale_submissions():
    """Check for submissions that might need attention"""
    db = SessionLocal()

    try:
        # Find submissions under review for more than 49 hours
        cutoff_time = datetime.utcnow() - timedelta(hours=49)
        stale_submissions = db.query(Submission).filter(
            Submission.status == 'under_review',
            Submission.created_at < cutoff_time
        ).all()

        for submission in stale_submissions:
            logger.warning(f"Stale submission found: {submission.id}")
            monitor_pr_reviews.delay(submission.id)

    except Exception as e:
        logger.error(f"Error checking stale submissions: {e}")

    finally:
        db.close()

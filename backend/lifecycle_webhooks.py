import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import hmac
import hashlib

from flask import request, current_app
from werkzeug.exceptions import BadRequest, Unauthorized

from backend.models import db, Bounty, BountyStateTransition
from backend.lifecycle_engine import LifecycleEngine

logger = logging.getLogger(__name__)


class WebhookProcessor:
    """Process GitHub webhook events for bounty lifecycle state transitions."""

    def __init__(self):
        self.lifecycle_engine = LifecycleEngine()

    def verify_github_signature(self, payload: bytes, signature: str) -> bool:
        """Verify GitHub webhook signature using HMAC-SHA256."""
        if not signature:
            return False

        webhook_secret = current_app.config.get('GITHUB_WEBHOOK_SECRET', '')
        if not webhook_secret:
            logger.warning("No GitHub webhook secret configured")
            return False

        expected_signature = 'sha256=' + hmac.new(
            webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)

    def process_pr_webhook(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process pull request webhook events."""
        action = payload.get('action')
        pr_data = payload.get('pull_request', {})
        pr_number = pr_data.get('number')
        pr_state = pr_data.get('state')
        merged = pr_data.get('merged', False)

        if not pr_number:
            logger.warning("PR webhook missing number")
            return None

        logger.info(f"Processing PR #{pr_number} webhook: action={action}, state={pr_state}, merged={merged}")

        # Find bounties linked to this PR
        linked_bounties = self._find_bounties_for_pr(pr_number, payload)
        if not linked_bounties:
            logger.info(f"No bounties found for PR #{pr_number}")
            return None

        results = []
        for bounty in linked_bounties:
            result = self._handle_pr_state_change(bounty, action, pr_data)
            if result:
                results.append(result)

        return {'processed_bounties': results} if results else None

    def _find_bounties_for_pr(self, pr_number: int, payload: Dict[str, Any]) -> list:
        """Find bounties associated with a PR number."""
        # Check PR body for bounty references
        pr_body = payload.get('pull_request', {}).get('body', '')

        bounties = []

        # Look for "Closes #123" pattern
        import re
        close_patterns = [
            r'(?:closes?|fixes?|resolves?)\s+#(\d+)',
            r'#(\d+)'  # Simple #123 reference
        ]

        for pattern in close_patterns:
            matches = re.findall(pattern, pr_body, re.IGNORECASE)
            for match in matches:
                bounty_id = int(match)
                bounty = Bounty.query.filter_by(id=bounty_id).first()
                if bounty and bounty not in bounties:
                    bounties.append(bounty)

        return bounties

    def _handle_pr_state_change(self, bounty: Bounty, action: str, pr_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle state transitions based on PR events."""
        pr_number = pr_data.get('number')
        pr_state = pr_data.get('state')
        merged = pr_data.get('merged', False)
        author = pr_data.get('user', {}).get('login')

        try:
            if action == 'opened' and bounty.status == 'OPEN':
                # T1 bounties: open PR transitions to IN_REVIEW
                if bounty.tier == 'T1':
                    result = self.lifecycle_engine.submit_for_review(
                        bounty_id=bounty.id,
                        contributor_github=author,
                        pr_number=pr_number,
                        auto_transition=True
                    )
                    logger.info(f"T1 bounty {bounty.id} auto-transitioned to IN_REVIEW via PR #{pr_number}")
                    return result

                # T2/T3: check if bounty is claimed by this author
                elif bounty.status == 'CLAIMED' and bounty.claimed_by == author:
                    result = self.lifecycle_engine.submit_for_review(
                        bounty_id=bounty.id,
                        contributor_github=author,
                        pr_number=pr_number
                    )
                    logger.info(f"Claimed bounty {bounty.id} submitted for review via PR #{pr_number}")
                    return result

            elif action == 'closed' and merged and bounty.status == 'IN_REVIEW':
                # PR merged - transition to COMPLETED
                result = self.lifecycle_engine.mark_completed(
                    bounty_id=bounty.id,
                    reviewer_github=pr_data.get('merged_by', {}).get('login'),
                    pr_number=pr_number
                )
                logger.info(f"Bounty {bounty.id} marked completed via merged PR #{pr_number}")
                return result

            elif action == 'closed' and not merged and bounty.status == 'IN_REVIEW':
                # PR closed without merging - potentially reset to previous state
                if bounty.tier == 'T1':
                    # T1: reset to OPEN
                    result = self.lifecycle_engine.reset_to_open(
                        bounty_id=bounty.id,
                        reason=f"PR #{pr_number} closed without merging"
                    )
                    logger.info(f"T1 bounty {bounty.id} reset to OPEN after PR #{pr_number} closure")
                    return result
                else:
                    # T2/T3: reset to CLAIMED if still within deadline
                    if bounty.claimed_by:
                        result = self.lifecycle_engine.reset_to_claimed(
                            bounty_id=bounty.id,
                            reason=f"PR #{pr_number} closed without merging"
                        )
                        logger.info(f"Claimed bounty {bounty.id} reset after PR #{pr_number} closure")
                        return result

        except Exception as e:
            logger.error(f"Error processing PR webhook for bounty {bounty.id}: {str(e)}")
            return None

        return None


def process_webhook_event(event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Main webhook processing entry point."""
    processor = WebhookProcessor()

    # Verify signature if present
    signature = request.headers.get('X-Hub-Signature-256', '')
    if signature and not processor.verify_github_signature(request.data, signature):
        raise Unauthorized("Invalid webhook signature")

    if event_type == 'pull_request':
        result = processor.process_pr_webhook(payload)
        if result:
            db.session.commit()
            return result
        return {'message': 'No action taken'}

    elif event_type == 'ping':
        return {'message': 'Webhook ping received successfully'}

    else:
        logger.info(f"Ignoring webhook event type: {event_type}")
        return {'message': f'Event type {event_type} not handled'}


def log_webhook_event(event_type: str, payload: Dict[str, Any], result: Dict[str, Any]):
    """Log webhook events for debugging and audit purposes."""
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,
        'action': payload.get('action'),
        'pr_number': payload.get('pull_request', {}).get('number'),
        'repository': payload.get('repository', {}).get('full_name'),
        'result': result
    }

    logger.info(f"Webhook processed: {json.dumps(log_entry)}")

    # Store in database for audit trail
    try:
        transition = BountyStateTransition(
            bounty_id=None,  # Will be set if bounty was affected
            from_state='WEBHOOK',
            to_state='PROCESSED',
            trigger_event='webhook_received',
            metadata={
                'webhook_event': log_entry,
                'processed_at': datetime.utcnow().isoformat()
            }
        )
        db.session.add(transition)
        db.session.commit()
    except Exception as e:
        logger.error(f"Failed to log webhook event to database: {str(e)}")


def validate_webhook_payload(payload: Dict[str, Any], event_type: str) -> bool:
    """Validate webhook payload structure."""
    if event_type == 'pull_request':
        required_fields = ['action', 'pull_request', 'repository']
        for field in required_fields:
            if field not in payload:
                logger.error(f"Missing required field in webhook payload: {field}")
                return False

        pr_required = ['number', 'state', 'user']
        pr_data = payload.get('pull_request', {})
        for field in pr_required:
            if field not in pr_data:
                logger.error(f"Missing required PR field: {field}")
                return False

    return True

import hmac
import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from flask import request, current_app

from .models import Bounty, BountyState, db
from .exceptions import InvalidTransitionError, TerminalStateError

logger = logging.getLogger(__name__)


class GitHubWebhookHandler:
    """Handles GitHub webhook events for bounty lifecycle management."""

    def __init__(self):
        self.event_handlers = {
            'pull_request': self._handle_pull_request_event,
            'issues': self._handle_issues_event
        }

    def validate_signature(self, payload_body: bytes, signature_header: str) -> bool:
        """Validate GitHub webhook signature."""
        if not signature_header:
            logger.warning("Missing GitHub webhook signature")
            return False

        webhook_secret = current_app.config.get('GITHUB_WEBHOOK_SECRET')
        if not webhook_secret:
            logger.error("GitHub webhook secret not configured")
            return False

        try:
            sha_name, signature = signature_header.split('=')
            if sha_name != 'sha256':
                logger.warning(f"Unsupported signature algorithm: {sha_name}")
                return False

            mac = hmac.new(
                webhook_secret.encode('utf-8'),
                msg=payload_body,
                digestmod=hashlib.sha256
            )
            expected_signature = mac.hexdigest()

            return hmac.compare_digest(signature, expected_signature)
        except (ValueError, AttributeError) as e:
            logger.error(f"Error validating webhook signature: {e}")
            return False

    def process_webhook(self, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming webhook event."""
        try:
            if event_type not in self.event_handlers:
                logger.info(f"Ignoring unsupported event type: {event_type}")
                return {"status": "ignored", "reason": "unsupported_event_type"}

            handler = self.event_handlers[event_type]
            result = handler(payload)

            logger.info(f"Processed {event_type} webhook successfully")
            return {"status": "success", "result": result}

        except Exception as e:
            logger.error(f"Error processing {event_type} webhook: {str(e)}")
            return {"status": "error", "error": str(e)}

    def _handle_pull_request_event(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle pull request events for bounty state transitions."""
        action = payload.get('action')
        pr = payload.get('pull_request', {})

        if not pr:
            logger.warning("Pull request data missing from webhook")
            return None

        pr_number = pr.get('number')
        pr_body = pr.get('body', '')
        pr_author = pr.get('user', {}).get('login')

        # Extract bounty issue number from PR body
        bounty_issue = self._extract_issue_number(pr_body)
        if not bounty_issue:
            logger.debug(f"PR #{pr_number} does not reference a bounty issue")
            return None

        bounty = Bounty.query.filter_by(issue_number=bounty_issue).first()
        if not bounty:
            logger.warning(f"Bounty not found for issue #{bounty_issue}")
            return None

        try:
            if action == 'opened':
                return self._handle_pr_opened(bounty, pr_number, pr_author)
            elif action == 'closed':
                pr_merged = pr.get('merged', False)
                if pr_merged:
                    return self._handle_pr_merged(bounty, pr_number, pr_author)
                else:
                    return self._handle_pr_closed(bounty, pr_number, pr_author)
            else:
                logger.debug(f"Ignoring PR action: {action}")
                return None

        except (InvalidTransitionError, TerminalStateError) as e:
            logger.warning(f"Invalid bounty transition for PR #{pr_number}: {e}")
            return {"error": "invalid_transition", "message": str(e)}

    def _handle_issues_event(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle issue events for bounty lifecycle."""
        action = payload.get('action')
        issue = payload.get('issue', {})

        if not issue:
            return None

        issue_number = issue.get('number')
        labels = [label.get('name', '') for label in issue.get('labels', [])]

        # Check if this is a bounty issue
        bounty_labels = ['bounty', 'tier-1', 'tier-2', 'tier-3']
        if not any(label in bounty_labels for label in labels):
            return None

        bounty = Bounty.query.filter_by(issue_number=issue_number).first()

        try:
            if action == 'opened':
                if not bounty:
                    bounty = self._create_bounty_from_issue(issue)
                    db.session.add(bounty)
                    db.session.commit()
                    return {"action": "bounty_created", "issue": issue_number}

            elif action == 'closed':
                if bounty and bounty.state != BountyState.PAID:
                    bounty.cancel_bounty()
                    db.session.commit()
                    return {"action": "bounty_cancelled", "issue": issue_number}

            elif action == 'labeled':
                label = payload.get('label', {}).get('name')
                if label == 'bounty' and not bounty:
                    bounty = self._create_bounty_from_issue(issue)
                    db.session.add(bounty)
                    db.session.commit()
                    return {"action": "bounty_created", "issue": issue_number}

            return None

        except Exception as e:
            logger.error(f"Error handling issue event for #{issue_number}: {e}")
            db.session.rollback()
            raise

    def _handle_pr_opened(self, bounty: Bounty, pr_number: int, author: str) -> Dict[str, Any]:
        """Handle PR opened event - transition to in_review if claimed."""
        if bounty.state == BountyState.CLAIMED and bounty.claimed_by == author:
            bounty.transition_to_review()
            bounty.audit_log.append({
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'pr_opened',
                'pr_number': pr_number,
                'author': author,
                'state_from': 'claimed',
                'state_to': 'in_review'
            })
            db.session.commit()
            return {"action": "transitioned_to_review", "pr": pr_number}

        return {"action": "pr_opened_no_transition", "pr": pr_number}

    def _handle_pr_merged(self, bounty: Bounty, pr_number: int, author: str) -> Dict[str, Any]:
        """Handle PR merged event - transition to completed."""
        if bounty.state == BountyState.IN_REVIEW and bounty.claimed_by == author:
            bounty.complete_bounty()
            bounty.audit_log.append({
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'pr_merged',
                'pr_number': pr_number,
                'author': author,
                'state_from': 'in_review',
                'state_to': 'completed'
            })
            db.session.commit()
            return {"action": "bounty_completed", "pr": pr_number}

        return {"action": "pr_merged_no_transition", "pr": pr_number}

    def _handle_pr_closed(self, bounty: Bounty, pr_number: int, author: str) -> Dict[str, Any]:
        """Handle PR closed (not merged) event - potentially release claim."""
        if bounty.state == BountyState.IN_REVIEW and bounty.claimed_by == author:
            bounty.release_claim()
            bounty.audit_log.append({
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'pr_closed_unmerged',
                'pr_number': pr_number,
                'author': author,
                'state_from': 'in_review',
                'state_to': 'open'
            })
            db.session.commit()
            return {"action": "claim_released", "pr": pr_number}

        return {"action": "pr_closed_no_transition", "pr": pr_number}

    def _extract_issue_number(self, pr_body: str) -> Optional[int]:
        """Extract issue number from PR body (looks for 'Closes #123' pattern)."""
        if not pr_body:
            return None

        import re
        patterns = [
            r'[Cc]loses\s+#(\d+)',
            r'[Ff]ixes\s+#(\d+)',
            r'[Rr]esolves\s+#(\d+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, pr_body)
            if match:
                return int(match.group(1))

        return None

    def _create_bounty_from_issue(self, issue: Dict[str, Any]) -> Bounty:
        """Create a new bounty from GitHub issue data."""
        issue_number = issue.get('number')
        title = issue.get('title', '')
        description = issue.get('body', '')
        labels = [label.get('name', '') for label in issue.get('labels', [])]

        # Determine tier and reward from labels
        tier = 1
        reward_amount = 100000  # Default T1 reward

        if 'tier-2' in labels:
            tier = 2
            reward_amount = 400000
        elif 'tier-3' in labels:
            tier = 3
            reward_amount = 1000000

        bounty = Bounty(
            issue_number=issue_number,
            title=title,
            description=description,
            tier=tier,
            reward_amount=reward_amount,
            state=BountyState.OPEN
        )

        bounty.audit_log = [{
            'timestamp': datetime.utcnow().isoformat(),
            'action': 'bounty_created',
            'source': 'github_webhook',
            'issue_number': issue_number,
            'tier': tier
        }]

        return bounty


# Global webhook handler instance
webhook_handler = GitHubWebhookHandler()

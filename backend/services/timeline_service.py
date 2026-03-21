from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from backend.models.bounty import Bounty
from backend.models.user import User
from backend.models.timeline_event import TimelineEvent
from backend.database import get_db
from backend.services.auth_service import get_current_user

logger = logging.getLogger(__name__)


class TimelineService:
    """Service for managing bounty timeline events and history"""

    @staticmethod
    def add_event(
        db: Session,
        bounty_id: int,
        event_type: str,
        title: str,
        description: Optional[str] = None,
        user_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TimelineEvent:
        """Add a new timeline event to a bounty"""
        try:
            # Verify bounty exists
            bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
            if not bounty:
                raise ValueError(f"Bounty with ID {bounty_id} not found")

            event = TimelineEvent(
                bounty_id=bounty_id,
                event_type=event_type,
                title=title,
                description=description,
                user_id=user_id,
                metadata=metadata or {},
                created_at=datetime.utcnow()
            )

            db.add(event)
            db.commit()
            db.refresh(event)

            logger.info(f"Added timeline event {event_type} for bounty {bounty_id}")
            return event

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to add timeline event: {str(e)}")
            raise

    @staticmethod
    def get_bounty_timeline(
        db: Session,
        bounty_id: int,
        limit: Optional[int] = None,
        event_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve timeline events for a specific bounty"""
        try:
            query = db.query(TimelineEvent).filter(
                TimelineEvent.bounty_id == bounty_id
            )

            if event_types:
                query = query.filter(TimelineEvent.event_type.in_(event_types))

            query = query.order_by(desc(TimelineEvent.created_at))

            if limit:
                query = query.limit(limit)

            events = query.all()
            return [TimelineService._format_event(db, event) for event in events]

        except Exception as e:
            logger.error(f"Failed to retrieve timeline for bounty {bounty_id}: {str(e)}")
            raise

    @staticmethod
    def get_user_timeline(
        db: Session,
        user_id: int,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get timeline events for a specific user across all bounties"""
        try:
            query = db.query(TimelineEvent).filter(
                TimelineEvent.user_id == user_id
            ).order_by(desc(TimelineEvent.created_at))

            if limit:
                query = query.limit(limit)

            events = query.all()
            return [TimelineService._format_event(db, event) for event in events]

        except Exception as e:
            logger.error(f"Failed to retrieve user timeline for user {user_id}: {str(e)}")
            raise

    @staticmethod
    def _format_event(db: Session, event: TimelineEvent) -> Dict[str, Any]:
        """Format timeline event with user details and metadata"""
        formatted_event = {
            'id': event.id,
            'bounty_id': event.bounty_id,
            'event_type': event.event_type,
            'title': event.title,
            'description': event.description,
            'created_at': event.created_at.isoformat(),
            'metadata': event.metadata or {},
            'user': None
        }

        # Add user details if available
        if event.user_id:
            user = db.query(User).filter(User.id == event.user_id).first()
            if user:
                formatted_event['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'display_name': getattr(user, 'display_name', user.username),
                    'avatar_url': getattr(user, 'avatar_url', None)
                }

        # Format specific event types
        if event.event_type == 'status_change':
            old_status = event.metadata.get('old_status')
            new_status = event.metadata.get('new_status')
            if old_status and new_status:
                formatted_event['title'] = f"Status changed from {old_status} to {new_status}"

        elif event.event_type == 'submission':
            submission_url = event.metadata.get('submission_url')
            if submission_url:
                formatted_event['metadata']['formatted_url'] = submission_url

        elif event.event_type == 'payment':
            amount = event.metadata.get('amount')
            currency = event.metadata.get('currency', 'FNDRY')
            if amount:
                formatted_event['metadata']['formatted_amount'] = f"{amount:,.0f} {currency}"

        return formatted_event

    @staticmethod
    def add_bounty_created_event(db: Session, bounty: Bounty) -> TimelineEvent:
        """Add timeline event when bounty is created"""
        return TimelineService.add_event(
            db=db,
            bounty_id=bounty.id,
            event_type='bounty_created',
            title='Bounty created',
            description=f'New bounty "{bounty.title}" was created',
            user_id=bounty.creator_id,
            metadata={
                'reward_amount': bounty.reward_amount,
                'category': bounty.category,
                'difficulty': bounty.difficulty
            }
        )

    @staticmethod
    def add_status_change_event(
        db: Session,
        bounty_id: int,
        old_status: str,
        new_status: str,
        user_id: Optional[int] = None
    ) -> TimelineEvent:
        """Add timeline event for status changes"""
        return TimelineService.add_event(
            db=db,
            bounty_id=bounty_id,
            event_type='status_change',
            title=f'Status changed to {new_status}',
            user_id=user_id,
            metadata={
                'old_status': old_status,
                'new_status': new_status
            }
        )

    @staticmethod
    def add_submission_event(
        db: Session,
        bounty_id: int,
        submission_url: str,
        user_id: int,
        notes: Optional[str] = None
    ) -> TimelineEvent:
        """Add timeline event for bounty submissions"""
        return TimelineService.add_event(
            db=db,
            bounty_id=bounty_id,
            event_type='submission',
            title='Solution submitted',
            description=notes,
            user_id=user_id,
            metadata={
                'submission_url': submission_url,
                'submission_type': 'github_pr' if 'github.com' in submission_url else 'external'
            }
        )

    @staticmethod
    def add_payment_event(
        db: Session,
        bounty_id: int,
        amount: float,
        recipient_id: int,
        transaction_hash: Optional[str] = None
    ) -> TimelineEvent:
        """Add timeline event for bounty payments"""
        return TimelineService.add_event(
            db=db,
            bounty_id=bounty_id,
            event_type='payment',
            title='Payment processed',
            description=f'Bounty reward of {amount:,.0f} FNDRY paid',
            metadata={
                'amount': amount,
                'currency': 'FNDRY',
                'recipient_id': recipient_id,
                'transaction_hash': transaction_hash
            }
        )

    @staticmethod
    def add_comment_event(
        db: Session,
        bounty_id: int,
        user_id: int,
        comment_text: str
    ) -> TimelineEvent:
        """Add timeline event for comments"""
        preview = comment_text[:100] + "..." if len(comment_text) > 100 else comment_text

        return TimelineService.add_event(
            db=db,
            bounty_id=bounty_id,
            event_type='comment',
            title='New comment added',
            description=preview,
            user_id=user_id,
            metadata={
                'comment_length': len(comment_text),
                'has_code': '```' in comment_text or '<code>' in comment_text
            }
        )

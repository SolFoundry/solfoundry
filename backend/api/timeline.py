from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models.bounty import Bounty
from ..models.timeline import TimelineEvent
from ..schemas.timeline import TimelineEventResponse, TimelineResponse
from ..auth import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get("/{bounty_id}", response_model=TimelineResponse)
async def get_bounty_timeline(
    bounty_id: int,
    limit: Optional[int] = 50,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Retrieve chronological timeline events for a specific bounty.
    """
    try:
        # Verify bounty exists
        bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise HTTPException(status_code=404, detail="Bounty not found")

        # Check if bounty is private and user has access
        if bounty.is_private and (not current_user or current_user.id != bounty.creator_id):
            raise HTTPException(status_code=403, detail="Access denied to private bounty")

        # Query timeline events
        events_query = (
            db.query(TimelineEvent)
            .filter(TimelineEvent.bounty_id == bounty_id)
            .order_by(TimelineEvent.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        events = events_query.all()

        # Get total count for pagination
        total_count = (
            db.query(TimelineEvent)
            .filter(TimelineEvent.bounty_id == bounty_id)
            .count()
        )

        # Convert to response models
        timeline_events = []
        for event in events:
            event_data = TimelineEventResponse(
                id=event.id,
                bounty_id=event.bounty_id,
                event_type=event.event_type,
                title=event.title,
                description=event.description,
                metadata=event.metadata or {},
                user_id=event.user_id,
                username=event.user.username if event.user else None,
                avatar_url=event.user.avatar_url if event.user else None,
                created_at=event.created_at,
                is_milestone=event.is_milestone
            )
            timeline_events.append(event_data)

        return TimelineResponse(
            bounty_id=bounty_id,
            events=timeline_events,
            total_count=total_count,
            has_more=offset + len(events) < total_count,
            bounty_title=bounty.title,
            bounty_status=bounty.status
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching timeline for bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{bounty_id}/events")
async def create_timeline_event(
    bounty_id: int,
    event_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Create a new timeline event for a bounty (admin/system use).
    """
    try:
        # Verify bounty exists
        bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise HTTPException(status_code=404, detail="Bounty not found")

        # Only allow bounty creator or admin to add events
        if not current_user or (current_user.id != bounty.creator_id and not current_user.is_admin):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Create new timeline event
        new_event = TimelineEvent(
            bounty_id=bounty_id,
            event_type=event_data.get("event_type", "custom"),
            title=event_data.get("title", ""),
            description=event_data.get("description", ""),
            metadata=event_data.get("metadata", {}),
            user_id=current_user.id,
            is_milestone=event_data.get("is_milestone", False)
        )

        db.add(new_event)
        db.commit()
        db.refresh(new_event)

        # Return created event
        return TimelineEventResponse(
            id=new_event.id,
            bounty_id=new_event.bounty_id,
            event_type=new_event.event_type,
            title=new_event.title,
            description=new_event.description,
            metadata=new_event.metadata,
            user_id=new_event.user_id,
            username=current_user.username,
            avatar_url=current_user.avatar_url,
            created_at=new_event.created_at,
            is_milestone=new_event.is_milestone
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating timeline event for bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create timeline event")

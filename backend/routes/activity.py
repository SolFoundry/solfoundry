from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from ..database import get_db
from ..models import Activity, User
from ..schemas import ActivityCreate, ActivityResponse, PaginatedActivities
from ..auth import get_current_user
from sqlalchemy import desc, and_, or_

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=PaginatedActivities)
async def get_activity_feed(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of activities to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of activities to return"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID")
):
    """
    Get paginated activity feed with optional filtering
    """
    try:
        query = db.query(Activity).order_by(desc(Activity.created_at))

        # Apply filters if provided
        filters = []
        if activity_type:
            filters.append(Activity.activity_type == activity_type)
        if user_id:
            filters.append(Activity.user_id == user_id)

        if filters:
            query = query.filter(and_(*filters))

        # Get total count for pagination
        total = query.count()

        # Apply pagination
        activities = query.offset(skip).limit(limit).all()

        return PaginatedActivities(
            activities=[ActivityResponse.from_orm(activity) for activity in activities],
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + limit < total
        )

    except Exception as e:
        logger.error(f"Failed to fetch activity feed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch activities")


@router.get("/user/{user_id}", response_model=PaginatedActivities)
async def get_user_activities(
    user_id: str,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    activity_type: Optional[str] = Query(None)
):
    """
    Get activities for a specific user
    """
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        query = db.query(Activity).filter(
            Activity.user_id == user_id
        ).order_by(desc(Activity.created_at))

        if activity_type:
            query = query.filter(Activity.activity_type == activity_type)

        total = query.count()
        activities = query.offset(skip).limit(limit).all()

        return PaginatedActivities(
            activities=[ActivityResponse.from_orm(activity) for activity in activities],
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + limit < total
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch user activities for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch user activities")


@router.post("", response_model=ActivityResponse, status_code=201)
async def create_activity(
    activity_data: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new activity entry
    """
    try:
        # Verify the user exists if different from current user
        if activity_data.user_id != current_user.id:
            target_user = db.query(User).filter(User.id == activity_data.user_id).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Target user not found")

        # Create new activity
        db_activity = Activity(
            user_id=activity_data.user_id,
            activity_type=activity_data.activity_type,
            title=activity_data.title,
            description=activity_data.description,
            metadata=activity_data.metadata or {},
            entity_type=activity_data.entity_type,
            entity_id=activity_data.entity_id
        )

        db.add(db_activity)
        db.commit()
        db.refresh(db_activity)

        logger.info(f"Created activity {db_activity.id} for user {activity_data.user_id}")

        return ActivityResponse.from_orm(db_activity)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create activity: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create activity")


@router.get("/types", response_model=List[str])
async def get_activity_types(db: Session = Depends(get_db)):
    """
    Get list of available activity types
    """
    try:
        types = db.query(Activity.activity_type).distinct().all()
        return [t[0] for t in types if t[0]]

    except Exception as e:
        logger.error(f"Failed to fetch activity types: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch activity types")


@router.get("/stats", response_model=dict)
async def get_activity_stats(
    db: Session = Depends(get_db),
    user_id: Optional[str] = Query(None, description="Get stats for specific user")
):
    """
    Get activity statistics
    """
    try:
        query = db.query(Activity)

        if user_id:
            # Verify user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            query = query.filter(Activity.user_id == user_id)

        total_activities = query.count()

        # Get activity type breakdown
        type_stats = {}
        for activity_type, count in db.query(
            Activity.activity_type,
            db.func.count(Activity.id)
        ).filter(
            Activity.user_id == user_id if user_id else True
        ).group_by(Activity.activity_type).all():
            type_stats[activity_type] = count

        return {
            "total_activities": total_activities,
            "activity_types": type_stats,
            "user_scope": user_id is not None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch activity stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch activity stats")

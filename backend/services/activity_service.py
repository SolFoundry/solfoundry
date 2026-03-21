from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from backend.models.activity import Activity
from backend.models.user import User
from backend.models.bounty import Bounty
from backend.database import get_db
import logging

logger = logging.getLogger(__name__)


class ActivityService:
    """Service for managing user activities and global activity feeds."""

    def __init__(self, db: Session):
        self.db = db

    def create_activity(
        self,
        user_id: str,
        activity_type: str,
        title: str,
        description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        bounty_id: Optional[str] = None
    ) -> Activity:
        """Create a new activity entry."""
        try:
            activity = Activity(
                user_id=user_id,
                activity_type=activity_type,
                title=title,
                description=description,
                metadata=metadata or {},
                bounty_id=bounty_id,
                created_at=datetime.utcnow()
            )

            self.db.add(activity)
            self.db.commit()
            self.db.refresh(activity)

            logger.info(f"Created activity {activity.id} for user {user_id}")
            return activity

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create activity: {str(e)}")
            raise

    def get_user_activities(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        activity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get activities for a specific user."""
        try:
            query = self.db.query(Activity).filter(Activity.user_id == user_id)

            if activity_type:
                query = query.filter(Activity.activity_type == activity_type)

            activities = (query
                         .order_by(desc(Activity.created_at))
                         .offset(offset)
                         .limit(limit)
                         .all())

            return [self._format_activity(activity) for activity in activities]

        except Exception as e:
            logger.error(f"Failed to get user activities: {str(e)}")
            return []

    def get_global_feed(
        self,
        limit: int = 50,
        offset: int = 0,
        hours_back: int = 168  # 7 days default
    ) -> List[Dict[str, Any]]:
        """Get global activity feed with deduplication."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)

            # Get recent activities with user and bounty data
            activities = (self.db.query(Activity)
                         .join(User, Activity.user_id == User.id)
                         .outerjoin(Bounty, Activity.bounty_id == Bounty.id)
                         .filter(Activity.created_at >= cutoff_time)
                         .order_by(desc(Activity.created_at))
                         .offset(offset)
                         .limit(limit * 2)  # Get more for deduplication
                         .all())

            # Apply deduplication and formatting
            deduplicated = self._deduplicate_activities(activities)
            formatted = [self._format_activity_with_context(act) for act in deduplicated]

            return formatted[:limit]

        except Exception as e:
            logger.error(f"Failed to get global feed: {str(e)}")
            return []

    def get_activity_stats(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Get activity statistics for a user."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(days=days)

            activities = (self.db.query(Activity)
                         .filter(and_(
                             Activity.user_id == user_id,
                             Activity.created_at >= cutoff_time
                         ))
                         .all())

            stats = {
                "total_activities": len(activities),
                "by_type": {},
                "daily_counts": {},
                "most_active_day": None,
                "streak_days": 0
            }

            # Count by type
            for activity in activities:
                activity_type = activity.activity_type
                stats["by_type"][activity_type] = stats["by_type"].get(activity_type, 0) + 1

            # Daily activity counts
            for activity in activities:
                day_key = activity.created_at.strftime("%Y-%m-%d")
                stats["daily_counts"][day_key] = stats["daily_counts"].get(day_key, 0) + 1

            # Find most active day
            if stats["daily_counts"]:
                most_active = max(stats["daily_counts"].items(), key=lambda x: x[1])
                stats["most_active_day"] = {
                    "date": most_active[0],
                    "count": most_active[1]
                }

            # Calculate streak
            stats["streak_days"] = self._calculate_activity_streak(user_id)

            return stats

        except Exception as e:
            logger.error(f"Failed to get activity stats: {str(e)}")
            return {"total_activities": 0, "by_type": {}, "daily_counts": {}}

    def _deduplicate_activities(self, activities: List[Activity]) -> List[Activity]:
        """Remove duplicate similar activities within time windows."""
        if not activities:
            return []

        deduplicated = []
        seen_patterns = set()

        for activity in activities:
            # Create pattern for deduplication
            pattern = self._create_dedup_pattern(activity)

            # Check if we've seen this pattern recently (within 1 hour)
            recent_cutoff = activity.created_at - timedelta(hours=1)
            is_duplicate = False

            for existing in deduplicated:
                if (existing.created_at >= recent_cutoff and
                    self._create_dedup_pattern(existing) == pattern):
                    is_duplicate = True
                    break

            if not is_duplicate:
                deduplicated.append(activity)

        return deduplicated

    def _create_dedup_pattern(self, activity: Activity) -> str:
        """Create a pattern string for deduplication logic."""
        return f"{activity.user_id}:{activity.activity_type}:{activity.bounty_id or 'none'}"

    def _format_activity(self, activity: Activity) -> Dict[str, Any]:
        """Format activity for API response."""
        return {
            "id": activity.id,
            "user_id": activity.user_id,
            "activity_type": activity.activity_type,
            "title": activity.title,
            "description": activity.description,
            "metadata": activity.metadata,
            "bounty_id": activity.bounty_id,
            "created_at": activity.created_at.isoformat(),
            "formatted_time": self._format_relative_time(activity.created_at)
        }

    def _format_activity_with_context(self, activity: Activity) -> Dict[str, Any]:
        """Format activity with additional context (user, bounty info)."""
        formatted = self._format_activity(activity)

        # Add user context
        if hasattr(activity, 'user') and activity.user:
            formatted["user"] = {
                "id": activity.user.id,
                "username": activity.user.username,
                "avatar_url": getattr(activity.user, 'avatar_url', None)
            }

        # Add bounty context
        if hasattr(activity, 'bounty') and activity.bounty:
            formatted["bounty"] = {
                "id": activity.bounty.id,
                "title": activity.bounty.title,
                "reward_amount": activity.bounty.reward_amount,
                "status": activity.bounty.status
            }

        return formatted

    def _format_relative_time(self, timestamp: datetime) -> str:
        """Format timestamp as relative time string."""
        now = datetime.utcnow()
        diff = now - timestamp

        if diff.seconds < 60:
            return "Just now"
        elif diff.seconds < 3600:
            minutes = diff.seconds // 60
            return f"{minutes}m ago"
        elif diff.days == 0:
            hours = diff.seconds // 3600
            return f"{hours}h ago"
        elif diff.days == 1:
            return "Yesterday"
        elif diff.days < 7:
            return f"{diff.days}d ago"
        else:
            return timestamp.strftime("%b %d")

    def _calculate_activity_streak(self, user_id: str) -> int:
        """Calculate consecutive days of activity."""
        try:
            current_date = datetime.utcnow().date()
            streak = 0

            for i in range(365):  # Max 1 year lookback
                check_date = current_date - timedelta(days=i)

                has_activity = (self.db.query(Activity)
                              .filter(and_(
                                  Activity.user_id == user_id,
                                  Activity.created_at >= datetime.combine(check_date, datetime.min.time()),
                                  Activity.created_at < datetime.combine(check_date + timedelta(days=1), datetime.min.time())
                              ))
                              .first() is not None)

                if has_activity:
                    streak += 1
                else:
                    break

            return streak

        except Exception as e:
            logger.error(f"Failed to calculate activity streak: {str(e)}")
            return 0

    def create_bounty_activity(self, user_id: str, bounty_id: str, action: str) -> Optional[Activity]:
        """Helper to create bounty-related activities."""
        activity_map = {
            "created": {
                "type": "bounty_created",
                "title": "Created a new bounty"
            },
            "claimed": {
                "type": "bounty_claimed",
                "title": "Claimed a bounty"
            },
            "completed": {
                "type": "bounty_completed",
                "title": "Completed a bounty"
            },
            "submitted": {
                "type": "bounty_submitted",
                "title": "Submitted bounty solution"
            }
        }

        if action not in activity_map:
            return None

        config = activity_map[action]
        return self.create_activity(
            user_id=user_id,
            activity_type=config["type"],
            title=config["title"],
            bounty_id=bounty_id,
            metadata={"action": action}
        )

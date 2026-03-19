from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass

from app.core.database import get_db
from app.core.cache import get_redis_client
from app.models.user import User
from app.models.contribution import Contribution
import json

logger = logging.getLogger(__name__)

@dataclass
class LeaderboardEntry:
    user_id: int
    username: str
    avatar_url: Optional[str]
    total_score: float
    contribution_count: int
    rank: int
    is_top_three: bool
    recent_contributions: int
    streak_days: int

class LeaderboardService:
    def __init__(self):
        self.cache_client = get_redis_client()
        self.cache_ttl = 300  # 5 minutes
        
    async def get_leaderboard(
        self,
        limit: int = 100,
        time_period: str = "all_time",
        category: Optional[str] = None
    ) -> List[LeaderboardEntry]:
        """
        Fetch ranked contributors using materialized views with caching
        """
        cache_key = f"leaderboard:{time_period}:{category}:{limit}"
        
        # Try to get from cache first
        cached_result = await self._get_from_cache(cache_key)
        if cached_result:
            return cached_result
            
        # Fetch from database using materialized view
        leaderboard_data = await self._fetch_leaderboard_data(
            limit=limit,
            time_period=time_period,
            category=category
        )
        
        # Process and rank the data
        leaderboard_entries = await self._process_leaderboard_data(leaderboard_data)
        
        # Cache the result
        await self._cache_result(cache_key, leaderboard_entries)
        
        return leaderboard_entries
    
    async def _fetch_leaderboard_data(
        self,
        limit: int,
        time_period: str,
        category: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Fetch data from materialized view based on time period and category
        """
        db = get_db()
        
        # Determine time filter
        time_filter = self._get_time_filter(time_period)
        
        # Build query based on materialized view
        if time_period == "all_time":
            base_query = """
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.avatar_url,
                    lv.total_score,
                    lv.contribution_count,
                    lv.recent_contributions_7d,
                    lv.current_streak_days
                FROM leaderboard_view lv
                JOIN users u ON lv.user_id = u.id
                WHERE lv.total_score > 0
            """
        else:
            # Use dynamic query for specific time periods
            base_query = """
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.avatar_url,
                    SUM(c.score) as total_score,
                    COUNT(c.id) as contribution_count,
                    COUNT(CASE WHEN c.created_at >= %s THEN 1 END) as recent_contributions_7d,
                    0 as current_streak_days
                FROM users u
                JOIN contributions c ON u.id = c.user_id
                WHERE c.created_at >= %s
                AND c.status = 'approved'
            """
        
        # Add category filter if specified
        if category:
            if time_period == "all_time":
                base_query += " AND lv.category = %s"
                params = [category]
            else:
                base_query += " AND c.category = %s GROUP BY u.id, u.username, u.avatar_url"
                params = [time_filter, time_filter, category]
        else:
            if time_period == "all_time":
                params = []
            else:
                base_query += " GROUP BY u.id, u.username, u.avatar_url"
                params = [time_filter, time_filter]
        
        # Add ordering and limit
        base_query += " ORDER BY total_score DESC, contribution_count DESC LIMIT %s"
        params.append(limit)
        
        try:
            cursor = db.cursor(dictionary=True)
            cursor.execute(base_query, params)
            result = cursor.fetchall()
            cursor.close()
            return result
        except Exception as e:
            logger.error(f"Error fetching leaderboard data: {e}")
            return []
    
    async def _process_leaderboard_data(
        self, 
        raw_data: List[Dict[str, Any]]
    ) -> List[LeaderboardEntry]:
        """
        Process raw data into LeaderboardEntry objects with ranking
        """
        entries = []
        
        for rank, row in enumerate(raw_data, 1):
            # Calculate streak if not provided
            streak_days = row.get('current_streak_days', 0)
            if streak_days == 0:
                streak_days = await self._calculate_user_streak(row['user_id'])
            
            entry = LeaderboardEntry(
                user_id=row['user_id'],
                username=row['username'],
                avatar_url=row.get('avatar_url'),
                total_score=float(row['total_score']),
                contribution_count=row['contribution_count'],
                rank=rank,
                is_top_three=rank <= 3,
                recent_contributions=row.get('recent_contributions_7d', 0),
                streak_days=streak_days
            )
            entries.append(entry)
        
        return entries
    
    async def _calculate_user_streak(self, user_id: int) -> int:
        """
        Calculate current contribution streak for a user
        """
        db = get_db()
        
        query = """
            SELECT DATE(created_at) as contribution_date
            FROM contributions
            WHERE user_id = %s AND status = 'approved'
            ORDER BY contribution_date DESC
        """
        
        try:
            cursor = db.cursor()
            cursor.execute(query, [user_id])
            dates = [row[0] for row in cursor.fetchall()]
            cursor.close()
            
            if not dates:
                return 0
            
            # Calculate streak
            streak = 0
            current_date = datetime.now().date()
            
            for i, date in enumerate(dates):
                expected_date = current_date - timedelta(days=i)
                if date == expected_date:
                    streak += 1
                else:
                    break
            
            return streak
            
        except Exception as e:
            logger.error(f"Error calculating streak for user {user_id}: {e}")
            return 0
    
    def _get_time_filter(self, time_period: str) -> datetime:
        """
        Convert time period string to datetime filter
        """
        now = datetime.now()
        
        if time_period == "today":
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_period == "week":
            return now - timedelta(days=7)
        elif time_period == "month":
            return now - timedelta(days=30)
        elif time_period == "quarter":
            return now - timedelta(days=90)
        elif time_period == "year":
            return now - timedelta(days=365)
        else:  # all_time
            return datetime(1970, 1, 1)
    
    async def _get_from_cache(self, cache_key: str) -> Optional[List[LeaderboardEntry]]:
        """
        Retrieve leaderboard data from cache
        """
        try:
            cached_data = await self.cache_client.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                return [
                    LeaderboardEntry(**entry_data) 
                    for entry_data in data
                ]
        except Exception as e:
            logger.error(f"Error retrieving from cache: {e}")
        
        return None
    
    async def _cache_result(
        self, 
        cache_key: str, 
        entries: List[LeaderboardEntry]
    ) -> None:
        """
        Cache leaderboard results
        """
        try:
            # Convert entries to dict for JSON serialization
            serializable_data = [
                {
                    'user_id': entry.user_id,
                    'username': entry.username,
                    'avatar_url': entry.avatar_url,
                    'total_score': entry.total_score,
                    'contribution_count': entry.contribution_count,
                    'rank': entry.rank,
                    'is_top_three': entry.is_top_three,
                    'recent_contributions': entry.recent_contributions,
                    'streak_days': entry.streak_days
                }
                for entry in entries
            ]
            
            await self.cache_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(serializable_data)
            )
        except Exception as e:
            logger.error(f"Error caching result: {e}")
    
    async def get_user_rank(
        self, 
        user_id: int, 
        time_period: str = "all_time"
    ) -> Optional[Dict[str, Any]]:
        """
        Get specific user's rank and stats
        """
        cache_key = f"user_rank:{user_id}:{time_period}"
        
        # Try cache first
        try:
            cached_result = await self.cache_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
        except Exception as e:
            logger.error(f"Error retrieving user rank from cache: {e}")
        
        # Query database
        db = get_db()
        time_filter = self._get_time_filter(time_period)
        
        if time_period == "all_time":
            query = """
                SELECT 
                    lv.total_score,
                    lv.contribution_count,
                    lv.current_streak_days,
                    (
                        SELECT COUNT(*) + 1 
                        FROM leaderboard_view lv2 
                        WHERE lv2.total_score > lv.total_score
                    ) as rank
                FROM leaderboard_view lv
                WHERE lv.user_id = %s
            """
            params = [user_id]
        else:
            query = """
                WITH user_stats AS (
                    SELECT 
                        SUM(c.score) as total_score,
                        COUNT(c.id) as contribution_count
                    FROM contributions c
                    WHERE c.user_id = %s 
                    AND c.created_at >= %s 
                    AND c.status = 'approved'
                )
                SELECT 
                    us.total_score,
                    us.contribution_count,
                    0 as current_streak_days,
                    (
                        SELECT COUNT(DISTINCT c2.user_id) + 1
                        FROM contributions c2
                        WHERE c2.created_at >= %s 
                        AND c2.status = 'approved'
                        GROUP BY c2.user_id
                        HAVING SUM(c2.score) > us.total_score
                    ) as rank
                FROM user_stats us
            """
            params = [user_id, time_filter, time_filter]
        
        try:
            cursor = db.cursor(dictionary=True)
            cursor.execute(query, params)
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                # Add streak calculation for non-all_time periods
                if time_period != "all_time":
                    result['current_streak_days'] = await self._calculate_user_streak(user_id)
                
                # Cache result
                await self.cache_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(result, default=str)
                )
                
                return result
        except Exception as e:
            logger.error(f"Error fetching user rank: {e}")
        
        return None
    
    async def invalidate_cache(self, pattern: Optional[str] = None) -> None:
        """
        Invalidate leaderboard cache
        """
        try:
            if pattern:
                keys = await self.cache_client.keys(pattern)
                if keys:
                    await self.cache_client.delete(*keys)
            else:
                # Invalidate all leaderboard caches
                keys = await self.cache_client.keys("leaderboard:*")
                user_rank_keys = await self.cache_client.keys("user_rank:*")
                
                all_keys = keys + user_rank_keys
                if all_keys:
                    await self.cache_client.delete(*all_keys)
                    
            logger.info("Leaderboard cache invalidated")
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")

# Global service instance
leaderboard_service = LeaderboardService()
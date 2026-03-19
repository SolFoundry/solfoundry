from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel, validator
from datetime import datetime
import asyncpg
import os

router = APIRouter()

class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    score: int
    rank: int
    created_at: datetime

class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total_count: int
    page: int
    limit: int

class LeaderboardParams(BaseModel):
    page: int = 1
    limit: int = 10
    time_range: Optional[str] = None
    category: Optional[str] = None

    @validator('page')
    def validate_page(cls, v):
        if v < 1:
            raise ValueError('Page must be greater than 0')
        return v

    @validator('limit')
    def validate_limit(cls, v):
        if v < 1 or v > 100:
            raise ValueError('Limit must be between 1 and 100')
        return v

    @validator('time_range')
    def validate_time_range(cls, v):
        if v is not None and v not in ['daily', 'weekly', 'monthly', 'all_time']:
            raise ValueError('Time range must be one of: daily, weekly, monthly, all_time')
        return v

async def get_db_connection():
    return await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "leaderboard")
    )

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of entries per page"),
    time_range: Optional[str] = Query(None, regex="^(daily|weekly|monthly|all_time)$", description="Time range filter"),
    category: Optional[str] = Query(None, description="Category filter")
):
    try:
        params = LeaderboardParams(
            page=page,
            limit=limit,
            time_range=time_range,
            category=category
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    conn = None
    try:
        conn = await get_db_connection()
        
        # Build WHERE clause based on filters
        where_conditions = []
        query_params = []
        param_count = 0
        
        if params.time_range and params.time_range != 'all_time':
            param_count += 1
            if params.time_range == 'daily':
                where_conditions.append(f"created_at >= NOW() - INTERVAL '1 day'")
            elif params.time_range == 'weekly':
                where_conditions.append(f"created_at >= NOW() - INTERVAL '1 week'")
            elif params.time_range == 'monthly':
                where_conditions.append(f"created_at >= NOW() - INTERVAL '1 month'")
        
        if params.category:
            param_count += 1
            where_conditions.append(f"category = ${param_count}")
            query_params.append(params.category)
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Get total count
        count_query = f"""
            SELECT COUNT(*) 
            FROM leaderboard_entries 
            {where_clause}
        """
        total_count = await conn.fetchval(count_query, *query_params)
        
        # Get leaderboard entries with ranking
        offset = (params.page - 1) * params.limit
        param_count += 1
        limit_param = f"${param_count}"
        param_count += 1
        offset_param = f"${param_count}"
        
        query = f"""
            SELECT 
                user_id,
                username,
                score,
                ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as rank,
                created_at
            FROM leaderboard_entries
            {where_clause}
            ORDER BY score DESC, created_at ASC
            LIMIT {limit_param} OFFSET {offset_param}
        """
        
        query_params.extend([params.limit, offset])
        rows = await conn.fetch(query, *query_params)
        
        entries = [
            LeaderboardEntry(
                user_id=row['user_id'],
                username=row['username'],
                score=row['score'],
                rank=row['rank'] + offset,
                created_at=row['created_at']
            )
            for row in rows
        ]
        
        return LeaderboardResponse(
            entries=entries,
            total_count=total_count,
            page=params.page,
            limit=params.limit
        )
        
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            await conn.close()
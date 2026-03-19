from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import Optional, List
from app.database import get_db
from app.models.bounty import Bounty
from app.models.user import User
from app.schemas.bounty import BountyResponse
from app.schemas.search import SearchResponse, SearchFilters
from enum import Enum
import math

router = APIRouter(prefix="/bounties", tags=["bounties"])

class SortBy(str, Enum):
    RELEVANCE = "relevance"
    CREATED_DATE = "created_date"
    REWARD_AMOUNT = "reward_amount"
    DEADLINE = "deadline"

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

@router.get("/search", response_model=SearchResponse)
async def search_bounties(
    q: Optional[str] = Query(None, description="Search query for full-text search"),
    category: Optional[str] = Query(None, description="Filter by category"),
    min_reward: Optional[float] = Query(None, description="Minimum reward amount"),
    max_reward: Optional[float] = Query(None, description="Maximum reward amount"),
    status: Optional[str] = Query(None, description="Filter by status"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    location: Optional[str] = Query(None, description="Filter by location"),
    creator_id: Optional[int] = Query(None, description="Filter by creator ID"),
    sort_by: SortBy = Query(SortBy.RELEVANCE, description="Sort results by"),
    sort_order: SortOrder = Query(SortOrder.DESC, description="Sort order"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of results per page"),
    db: Session = Depends(get_db)
):
    """
    Search bounties with full-text search, filtering, sorting, and pagination
    """
    # Base query
    query = db.query(Bounty).join(User, Bounty.creator_id == User.id)
    
    # Full-text search using PostgreSQL FTS
    if q:
        # Create full-text search vector combining title, description, and tags
        search_vector = func.to_tsvector(
            'english',
            func.coalesce(Bounty.title, '') + ' ' + 
            func.coalesce(Bounty.description, '') + ' ' + 
            func.coalesce(func.array_to_string(Bounty.tags, ' '), '')
        )
        
        search_query = func.plainto_tsquery('english', q)
        
        # Add search condition and rank
        query = query.filter(search_vector.match(search_query))
        
        # Calculate relevance score for sorting
        if sort_by == SortBy.RELEVANCE:
            rank = func.ts_rank(search_vector, search_query).label('rank')
            query = query.add_columns(rank)
    
    # Apply filters
    filters = []
    
    if category:
        filters.append(Bounty.category == category)
    
    if min_reward is not None:
        filters.append(Bounty.reward_amount >= min_reward)
    
    if max_reward is not None:
        filters.append(Bounty.reward_amount <= max_reward)
    
    if status:
        filters.append(Bounty.status == status)
    
    if tags:
        # Filter bounties that contain any of the specified tags
        tag_conditions = []
        for tag in tags:
            tag_conditions.append(Bounty.tags.any(tag))
        filters.append(or_(*tag_conditions))
    
    if location:
        filters.append(Bounty.location.ilike(f"%{location}%"))
    
    if creator_id:
        filters.append(Bounty.creator_id == creator_id)
    
    # Apply all filters
    if filters:
        query = query.filter(and_(*filters))
    
    # Get total count for pagination
    count_query = query
    if q and sort_by == SortBy.RELEVANCE:
        # Remove the rank column for counting
        count_query = db.query(Bounty).join(User, Bounty.creator_id == User.id)
        if q:
            search_vector = func.to_tsvector(
                'english',
                func.coalesce(Bounty.title, '') + ' ' + 
                func.coalesce(Bounty.description, '') + ' ' + 
                func.coalesce(func.array_to_string(Bounty.tags, ' '), '')
            )
            search_query = func.plainto_tsquery('english', q)
            count_query = count_query.filter(search_vector.match(search_query))
        
        if filters:
            count_query = count_query.filter(and_(*filters))
    
    total_count = count_query.count()
    
    # Apply sorting
    if sort_by == SortBy.RELEVANCE and q:
        # Sort by relevance score
        if sort_order == SortOrder.DESC:
            query = query.order_by(text("rank DESC"))
        else:
            query = query.order_by(text("rank ASC"))
    elif sort_by == SortBy.CREATED_DATE:
        if sort_order == SortOrder.DESC:
            query = query.order_by(Bounty.created_at.desc())
        else:
            query = query.order_by(Bounty.created_at.asc())
    elif sort_by == SortBy.REWARD_AMOUNT:
        if sort_order == SortOrder.DESC:
            query = query.order_by(Bounty.reward_amount.desc())
        else:
            query = query.order_by(Bounty.reward_amount.asc())
    elif sort_by == SortBy.DEADLINE:
        if sort_order == SortOrder.DESC:
            query = query.order_by(Bounty.deadline.desc().nulls_last())
        else:
            query = query.order_by(Bounty.deadline.asc().nulls_last())
    else:
        # Default sort by created_at desc
        query = query.order_by(Bounty.created_at.desc())
    
    # Apply pagination
    offset = (page - 1) * page_size
    
    if q and sort_by == SortBy.RELEVANCE:
        # Handle the case where we have rank column
        results = query.offset(offset).limit(page_size).all()
        bounties = [result[0] if isinstance(result, tuple) else result for result in results]
    else:
        bounties = query.offset(offset).limit(page_size).all()
    
    # Calculate pagination metadata
    total_pages = math.ceil(total_count / page_size)
    has_next = page < total_pages
    has_prev = page > 1
    
    return SearchResponse(
        results=[BountyResponse.from_orm(bounty) for bounty in bounties],
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=has_next,
        has_prev=has_prev,
        filters=SearchFilters(
            category=category,
            min_reward=min_reward,
            max_reward=max_reward,
            status=status,
            tags=tags,
            location=location,
            creator_id=creator_id
        ),
        sort_by=sort_by,
        sort_order=sort_order,
        query=q
    )

@router.get("/search/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=2, description="Search query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Number of suggestions"),
    db: Session = Depends(get_db)
):
    """
    Get search suggestions based on partial query
    """
    # Get title suggestions using trigram similarity
    title_suggestions = db.query(Bounty.title).filter(
        func.similarity(Bounty.title, q) > 0.3
    ).order_by(
        func.similarity(Bounty.title, q).desc()
    ).limit(limit).all()
    
    # Get tag suggestions
    tag_suggestions = db.query(
        func.unnest(Bounty.tags).label('tag')
    ).filter(
        func.similarity(func.unnest(Bounty.tags), q) > 0.3
    ).distinct().order_by(
        func.similarity(func.unnest(Bounty.tags), q).desc()
    ).limit(limit).all()
    
    # Get category suggestions
    category_suggestions = db.query(Bounty.category).filter(
        func.similarity(Bounty.category, q) > 0.3
    ).distinct().order_by(
        func.similarity(Bounty.category, q).desc()
    ).limit(limit).all()
    
    return {
        "titles": [suggestion[0] for suggestion in title_suggestions],
        "tags": [suggestion[0] for suggestion in tag_suggestions if suggestion[0]],
        "categories": [suggestion[0] for suggestion in category_suggestions if suggestion[0]]
    }
"""Contributor profiles API router.

## Overview

Contributors are users who complete bounties on SolFoundry. Each contributor has:
- **Profile**: Username, display name, bio, avatar
- **Skills**: Technical skills they can contribute
- **Badges**: Achievement badges earned
- **Stats**: Contributions, earnings, reputation score

## Profile Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| username | string | Unique username (3-50 chars) |
| display_name | string | Display name (1-100 chars) |
| email | string | Email address (optional) |
| avatar_url | string | Profile picture URL |
| bio | string | Biography text |
| skills | array | Technical skills |
| badges | array | Achievement badges |
| social_links | object | Social media links |

## Stats Fields

| Field | Type | Description |
|-------|------|-------------|
| total_contributions | integer | Total PR contributions |
| total_bounties_completed | integer | Completed bounties |
| total_earnings | float | Total $FNDRY earned |
| reputation_score | integer | Reputation points |

## Rate Limits

- List/Search: 100 requests/minute
- CRUD operations: 30 requests/minute
"""

from typing import Optional

from fastapi import APIRouter, Query
from app.models.contributor import (
    ContributorCreate,
    ContributorResponse,
    ContributorListResponse,
    ContributorUpdate,
)
from app.services import contributor_service
from app.core.errors import NotFoundException, ConflictException
from app.core.logging_config import get_logger
from app.core.audit import audit_log, AuditAction


logger = get_logger(__name__)
router = APIRouter(prefix="/api/contributors", tags=["contributors"])


@router.get(
    "",
    response_model=ContributorListResponse,
    summary="List contributors",
    description="""
Get a paginated list of contributors with optional filtering.

## Filter Options

- **search**: Search by username or display name
- **skills**: Filter by skills (comma-separated)
- **badges**: Filter by badges (comma-separated)

## Example Requests

```
GET /api/contributors?search=john&skills=rust,solana
GET /api/contributors?badges=tier-3-veteran&limit=50
```

## Rate Limit

100 requests per minute.
""",
    responses={
        200: {
            "description": "List of contributors",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "username": "soldev",
                                "display_name": "Sol Developer",
                                "avatar_url": "https://avatars.githubusercontent.com/u/12345",
                                "skills": ["rust", "solana", "anchor"],
                                "badges": ["tier-1-veteran", "early-contributor"],
                                "stats": {
                                    "total_contributions": 25,
                                    "total_bounties_completed": 10,
                                    "total_earnings": 5000.0,
                                    "reputation_score": 850
                                }
                            }
                        ],
                        "total": 150,
                        "skip": 0,
                        "limit": 20
                    }
                }
            }
        }
    }
)
async def list_contributors(
    search: Optional[str] = Query(
        None, description="Search by username or display name"
    ),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    badges: Optional[str] = Query(None, description="Comma-separated badge filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List contributors with optional filtering."""
    logger.debug(
        "Listing contributors",
        extra={
            "extra_data": {
                "search": search,
                "skills": skills,
                "badges": badges,
            }
        },
    )

    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return contributor_service.list_contributors(
        search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit
    )


@router.post(
    "",
    response_model=ContributorResponse,
    status_code=201,
    summary="Create a contributor profile",
    description="""
Create a new contributor profile.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Unique username (3-50 chars, alphanumeric + _ -) |
| display_name | string | Yes | Display name (1-100 chars) |
| email | string | No | Email address |
| avatar_url | string | No | Profile picture URL |
| bio | string | No | Biography text |
| skills | array | No | Technical skills |
| badges | array | No | Achievement badges |
| social_links | object | No | Social media links |

## Username Rules

- 3-50 characters
- Alphanumeric, underscore, and hyphen only
- Must be unique

## Rate Limit

30 requests per minute.
""",
    responses={
        201: {
            "description": "Contributor created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "username": "soldev",
                        "display_name": "Sol Developer",
                        "email": "sol@example.com",
                        "avatar_url": None,
                        "bio": "Building on Solana",
                        "skills": ["rust", "solana"],
                        "badges": [],
                        "social_links": {"twitter": "@soldev"},
                        "stats": {
                            "total_contributions": 0,
                            "total_bounties_completed": 0,
                            "total_earnings": 0.0,
                            "reputation_score": 0
                        },
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-01T00:00:00Z"
                    }
                }
            }
        },
        409: {"description": "Username already exists"},
        422: {"description": "Validation error"}
    }
)
async def create_contributor(data: ContributorCreate):
    """Create a new contributor profile."""
    logger.info(f"Creating contributor: {data.username}")

    if contributor_service.get_contributor_by_username(data.username):
        raise ConflictException(f"Username '{data.username}' already exists")

    contributor = contributor_service.create_contributor(data)

    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_REGISTERED,
        actor=data.username,
        resource="contributor",
        resource_id=contributor.id,
        metadata={
            "username": data.username,
        },
    )

    logger.info(f"Contributor created: {contributor.id}")

    return contributor


@router.get(
    "/{contributor_id}",
    response_model=ContributorResponse,
    summary="Get contributor by ID",
    description="""
Retrieve detailed information about a specific contributor.

## Response Fields

Includes full profile information and contribution statistics.

## Rate Limit

100 requests per minute.
""",
    responses={
        200: {
            "description": "Contributor details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "username": "soldev",
                        "display_name": "Sol Developer",
                        "email": "sol@example.com",
                        "avatar_url": "https://avatars.githubusercontent.com/u/12345",
                        "bio": "Building the future on Solana",
                        "skills": ["rust", "solana", "anchor", "typescript"],
                        "badges": ["tier-1-veteran", "early-contributor", "first-pr"],
                        "social_links": {"twitter": "@soldev", "github": "soldev"},
                        "stats": {
                            "total_contributions": 25,
                            "total_bounties_completed": 10,
                            "total_earnings": 5000.0,
                            "reputation_score": 850
                        },
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-15T00:00:00Z"
                    }
                }
            }
        },
        404: {"description": "Contributor not found"}
    }
)
async def get_contributor(contributor_id: str):
    """Get a contributor by ID."""
    logger.debug(f"Fetching contributor: {contributor_id}")

    c = contributor_service.get_contributor(contributor_id)
    if not c:
        raise NotFoundException("Contributor", contributor_id)
    return c


@router.patch(
    "/{contributor_id}",
    response_model=ContributorResponse,
    summary="Update contributor profile",
    description="""
Update an existing contributor profile.

## Updatable Fields

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| display_name | string | Display name (1-100 chars) |
| email | string | Email address |
| avatar_url | string | Profile picture URL |
| bio | string | Biography text |
| skills | array | Technical skills |
| badges | array | Achievement badges |
| social_links | object | Social media links |

## Note

Username cannot be changed after creation.

## Rate Limit

30 requests per minute.
""",
    responses={
        200: {
            "description": "Contributor updated successfully"
        },
        404: {"description": "Contributor not found"},
        422: {"description": "Validation error"}
    }
)
async def update_contributor(contributor_id: str, data: ContributorUpdate):
    """Update a contributor profile."""
    logger.info(f"Updating contributor: {contributor_id}")

    c = contributor_service.update_contributor(contributor_id, data)
    if not c:
        raise NotFoundException("Contributor", contributor_id)

    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_PROFILE_UPDATED,
        actor=contributor_id,
        resource="contributor",
        resource_id=contributor_id,
    )

    return c


@router.delete(
    "/{contributor_id}",
    status_code=204,
    summary="Delete contributor profile",
    description="""
Delete a contributor profile permanently.

## Warning

This action is irreversible. All profile data will be permanently deleted.

## Rate Limit

30 requests per minute.
""",
    responses={
        204: {"description": "Contributor deleted successfully"},
        404: {"description": "Contributor not found"}
    }
)
async def delete_contributor(contributor_id: str):
    """Delete a contributor profile."""
    logger.info(f"Deleting contributor: {contributor_id}")

    if not contributor_service.delete_contributor(contributor_id):
        raise NotFoundException("Contributor", contributor_id)
    
    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_BANNED,
        actor="api",
        resource="contributor",
        resource_id=contributor_id,
    )

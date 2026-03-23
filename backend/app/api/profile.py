"""
User profile API — view and update user profiles with git identity.

Endpoints:
  GET  /api/profile/:username  → public profile
  GET  /api/profile/me         → authenticated user's own profile
  PATCH /api/profile/me        → update own profile (display name, bio, links)
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.user import UserResponse

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ProfilePublic(BaseModel):
    """Public-facing contributor profile."""

    username: str
    github_id: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    bio: Optional[str] = None
    display_name: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    created_at: Optional[datetime] = None
    # Stats (pulled from leaderboard / contributor data)
    bounties_completed: int = 0
    total_earned_fndry: float = 0
    reputation_score: int = 0
    rank: Optional[int] = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    """Fields a user can update on their own profile."""

    display_name: Optional[str] = Field(None, max_length=64)
    bio: Optional[str] = Field(None, max_length=280)
    website: Optional[str] = Field(None, max_length=256)
    twitter: Optional[str] = Field(None, max_length=64)


class ProfileUpdateResponse(BaseModel):
    """Confirmation after profile update."""

    success: bool = True
    message: str = "Profile updated"
    profile: ProfilePublic


# ---------------------------------------------------------------------------
# Mock data store (swap for DB queries when auth + DB wiring lands)
# ---------------------------------------------------------------------------

_MOCK_PROFILES: dict[str, dict] = {
    "demo-contributor": {
        "username": "demo-contributor",
        "github_id": "12345678",
        "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
        "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "bio": "Full-stack dev building on Solana",
        "display_name": "Demo Dev",
        "website": "https://example.com",
        "twitter": "demodev",
        "created_at": datetime(2026, 1, 15, tzinfo=timezone.utc),
        "bounties_completed": 12,
        "total_earned_fndry": 450_000,
        "reputation_score": 87,
        "rank": 4,
    },
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=ProfilePublic,
    summary="Get own profile",
    description="Return the authenticated user's profile. Currently returns demo data until auth wiring is complete.",
)
async def get_own_profile() -> ProfilePublic:
    # TODO: wire to real auth — currently returns demo
    profile = _MOCK_PROFILES.get("demo-contributor")
    if not profile:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return ProfilePublic(**profile)


@router.get(
    "/{username}",
    response_model=ProfilePublic,
    summary="Get public profile",
    description="Retrieve a contributor's public profile by username.",
)
async def get_profile(username: str) -> ProfilePublic:
    profile = _MOCK_PROFILES.get(username)
    if not profile:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    return ProfilePublic(**profile)


@router.patch(
    "/me",
    response_model=ProfileUpdateResponse,
    summary="Update own profile",
    description="Update display name, bio, website, or Twitter handle.",
)
async def update_own_profile(body: ProfileUpdateRequest) -> ProfileUpdateResponse:
    # TODO: wire to real auth + DB
    profile = _MOCK_PROFILES.get("demo-contributor")
    if not profile:
        raise HTTPException(status_code=401, detail="Not authenticated")

    updates = body.model_dump(exclude_unset=True)
    profile.update(updates)

    return ProfileUpdateResponse(
        success=True,
        message=f"Updated {len(updates)} field(s)",
        profile=ProfilePublic(**profile),
    )

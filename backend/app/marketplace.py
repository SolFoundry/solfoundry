"""SolFoundry GitHub Repo Marketplace.

Backend for a marketplace where developers can list their repos
for bounty integration, browse available repos, and connect
repo owners with bounty creators.
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# --- Enums ---

class ListingStatus(str, Enum):
    active = "active"
    paused = "paused"
    removed = "removed"


class ListingCategory(str, Enum):
    defi = "defi"
    nft = "nft"
    dao = "dao"
    infrastructure = "infrastructure"
    developer_tools = "developer_tools"
    ai_ml = "ai_ml"
    gaming = "gaming"
    social = "social"
    security = "security"
    other = "other"


# --- Models ---

class RepoListing:
    """A GitHub repo listed on the marketplace."""

    def __init__(
        self,
        repo_url: str,
        owner: str,
        name: str,
        description: str,
        category: ListingCategory,
        listed_by: str,
        stars: int = 0,
        language: str = "",
        topics: list[str] = None,
        bounty_compatible: bool = True,
        bounty_count: int = 0,
    ):
        self.id = f"listing-{name}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        self.repo_url = repo_url
        self.owner = owner
        self.name = name
        self.description = description
        self.category = category
        self.listed_by = listed_by
        self.stars = stars
        self.language = language
        self.topics = topics or []
        self.bounty_compatible = bounty_compatible
        self.bounty_count = bounty_count
        self.status = ListingStatus.active
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.views = 0
        self.installs = 0
        self.rating: list[dict] = []

    def to_dict(self):
        return {
            "id": self.id,
            "repo_url": self.repo_url,
            "owner": self.owner,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "listed_by": self.listed_by,
            "stars": self.stars,
            "language": self.language,
            "topics": self.topics,
            "bounty_compatible": self.bounty_compatible,
            "bounty_count": self.bounty_count,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "views": self.views,
            "installs": self.installs,
            "avg_rating": self._avg_rating(),
        }

    def _avg_rating(self) -> float:
        if not self.rating:
            return 0.0
        return round(sum(r["score"] for r in self.rating) / len(self.rating), 1)


# --- Marketplace Service ---

class MarketplaceService:
    """Service for managing the repo marketplace."""

    def __init__(self):
        self.listings: dict[str, RepoListing] = {}

    # --- Listing CRUD ---

    def create_listing(self, listing: RepoListing) -> dict:
        """Create a new marketplace listing."""
        # Check for duplicate
        for existing in self.listings.values():
            if existing.repo_url == listing.repo_url and existing.status != ListingStatus.removed:
                return {"error": "Repo already listed"}

        self.listings[listing.id] = listing
        logger.info(f"Listing created: {listing.name} by {listing.listed_by}")
        return {"id": listing.id, "status": "active"}

    def get_listing(self, listing_id: str) -> Optional[dict]:
        """Get a listing by ID."""
        listing = self.listings.get(listing_id)
        if listing and listing.status != ListingStatus.removed:
            listing.views += 1  # Track views
            return listing.to_dict()
        return None

    def list_listings(
        self,
        category: Optional[str] = None,
        language: Optional[str] = None,
        search: Optional[str] = None,
        sort: str = "newest",
        limit: int = 50,
    ) -> list[dict]:
        """List marketplace listings with filters."""
        results = []
        for listing in self.listings.values():
            if listing.status == ListingStatus.removed:
                continue
            if category and listing.category.value != category:
                continue
            if language and listing.language.lower() != language.lower():
                continue
            if search:
                search_lower = search.lower()
                if (search_lower not in listing.name.lower() and
                    search_lower not in listing.description.lower() and
                    search_lower not in " ".join(listing.topics).lower()):
                    continue
            results.append(listing.to_dict())

        # Sort
        if sort == "newest":
            results.sort(key=lambda x: x["created_at"], reverse=True)
        elif sort == "stars":
            results.sort(key=lambda x: x["stars"], reverse=True)
        elif sort == "rating":
            results.sort(key=lambda x: x["avg_rating"], reverse=True)
        elif sort == "bounties":
            results.sort(key=lambda x: x["bounty_count"], reverse=True)
        elif sort == "popular":
            results.sort(key=lambda x: x["views"], reverse=True)

        return results[:limit]

    def update_listing(self, listing_id: str, **kwargs) -> dict:
        """Update a listing."""
        listing = self.listings.get(listing_id)
        if not listing:
            return {"error": "Listing not found"}

        for key, value in kwargs.items():
            if hasattr(listing, key):
                setattr(listing, key, value)

        listing.updated_at = datetime.now(timezone.utc).isoformat()
        return {"id": listing_id, "status": "updated"}

    def remove_listing(self, listing_id: str) -> dict:
        """Remove a listing (soft delete)."""
        listing = self.listings.get(listing_id)
        if not listing:
            return {"error": "Listing not found"}

        listing.status = ListingStatus.removed
        listing.updated_at = datetime.now(timezone.utc).isoformat()
        return {"id": listing_id, "status": "removed"}

    # --- Rating System ---

    def rate_listing(self, listing_id: str, user: str, score: int, comment: str = "") -> dict:
        """Rate a marketplace listing."""
        listing = self.listings.get(listing_id)
        if not listing:
            return {"error": "Listing not found"}

        if score < 1 or score > 5:
            return {"error": "Score must be 1-5"}

        # Check if user already rated
        existing = [r for r in listing.rating if r["user"] == user]
        if existing:
            # Update existing rating
            existing[0]["score"] = score
            existing[0]["comment"] = comment
        else:
            listing.rating.append({
                "user": user,
                "score": score,
                "comment": comment,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        return {"listing_id": listing_id, "avg_rating": listing._avg_rating()}

    # --- Stats ---

    def get_stats(self) -> dict:
        """Get marketplace statistics."""
        active = [l for l in self.listings.values() if l.status == ListingStatus.active]
        return {
            "total_listings": len(active),
            "total_views": sum(l.views for l in active),
            "total_installs": sum(l.installs for l in active),
            "by_category": self._count_by_field(active, "category"),
            "by_language": self._count_by_field(active, "language"),
        }

    @staticmethod
    def _count_by_field(items: list, field: str) -> dict:
        counts: dict[str, int] = {}
        for item in items:
            val = getattr(item, field, "")
            if isinstance(val, Enum):
                val = val.value
            if val:
                counts[val] = counts.get(val, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))


# --- FastAPI Router ---

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

marketplace_router = APIRouter()
service = MarketplaceService()


class CreateListingRequest(BaseModel):
    repo_url: str
    owner: str
    name: str
    description: str
    category: ListingCategory
    listed_by: str
    stars: int = 0
    language: str = ""
    topics: list[str] = []
    bounty_compatible: bool = True


class RateListingRequest(BaseModel):
    user: str
    score: int
    comment: str = ""


@marketplace_router.post("/api/marketplace/listings")
async def create_listing(request: CreateListingRequest):
    listing = RepoListing(**request.model_dump())
    result = service.create_listing(listing)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@marketplace_router.get("/api/marketplace/listings")
async def list_listings(
    category: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "newest",
    limit: int = 50,
):
    return {"listings": service.list_listings(category, language, search, sort, limit)}


@marketplace_router.get("/api/marketplace/listings/{listing_id}")
async def get_listing(listing_id: str):
    result = service.get_listing(listing_id)
    if not result:
        raise HTTPException(status_code=404, detail="Listing not found")
    return result


@marketplace_router.delete("/api/marketplace/listings/{listing_id}")
async def remove_listing(listing_id: str):
    result = service.remove_listing(listing_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@marketplace_router.post("/api/marketplace/listings/{listing_id}/rate")
async def rate_listing(listing_id: str, request: RateListingRequest):
    result = service.rate_listing(listing_id, request.user, request.score, request.comment)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@marketplace_router.get("/api/marketplace/stats")
async def marketplace_stats():
    return service.get_stats()

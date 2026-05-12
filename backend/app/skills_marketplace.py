"""SolFoundry Agent Skills Marketplace.

Backend for a marketplace where developers can publish, discover,
and install AI agent skills (plugins/extensions for autonomous agents).
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# --- Enums ---

class SkillStatus(str, Enum):
    draft = "draft"
    published = "published"
    deprecated = "deprecated"
    removed = "removed"


class SkillCategory(str, Enum):
    search = "search"
    code_generation = "code_generation"
    code_review = "code_review"
    testing = "testing"
    deployment = "deployment"
    security = "security"
    documentation = "documentation"
    data_analysis = "data_analysis"
    communication = "communication"
    memory = "memory"
    orchestration = "orchestration"
    custom = "custom"


class SkillCompatibility(str, Enum):
    openclaw = "openclaw"
    claude_code = "claude_code"
    cursor = "cursor"
    copilot = "copilot"
    generic = "generic"


# --- Models ---

class AgentSkill:
    """An AI agent skill listed on the marketplace."""

    def __init__(
        self,
        name: str,
        description: str,
        category: SkillCategory,
        author: str,
        version: str = "1.0.0",
        repo_url: str = "",
        skill_url: str = "",
        compatibility: list[SkillCompatibility] = None,
        tags: list[str] = None,
        readme: str = "",
        install_command: str = "",
        price_fndry: int = 0,  # 0 = free
    ):
        self.id = f"skill-{name.lower().replace(' ', '-')}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        self.name = name
        self.description = description
        self.category = category
        self.author = author
        self.version = version
        self.repo_url = repo_url
        self.skill_url = skill_url
        self.compatibility = compatibility or [SkillCompatibility.generic]
        self.tags = tags or []
        self.readme = readme
        self.install_command = install_command
        self.price_fndry = price_fndry
        self.status = SkillStatus.draft
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.downloads = 0
        self.installs = 0
        self.rating: list[dict] = []
        self.versions: list[dict] = [{"version": version, "released_at": self.created_at}]

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "author": self.author,
            "version": self.version,
            "repo_url": self.repo_url,
            "skill_url": self.skill_url,
            "compatibility": [c.value for c in self.compatibility],
            "tags": self.tags,
            "readme": self.readme[:500],
            "install_command": self.install_command,
            "price_fndry": self.price_fndry,
            "is_free": self.price_fndry == 0,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "downloads": self.downloads,
            "installs": self.installs,
            "avg_rating": self._avg_rating(),
            "rating_count": len(self.rating),
            "versions": self.versions,
        }

    def _avg_rating(self) -> float:
        if not self.rating:
            return 0.0
        return round(sum(r["score"] for r in self.rating) / len(self.rating), 1)


# --- Marketplace Service ---

class SkillsMarketplaceService:
    """Service for managing the agent skills marketplace."""

    def __init__(self):
        self.skills: dict[str, AgentSkill] = {}

    # --- Skill CRUD ---

    def publish_skill(self, skill: AgentSkill) -> dict:
        """Publish a new skill to the marketplace."""
        # Check for duplicate name by same author
        for existing in self.skills.values():
            if existing.name == skill.name and existing.author == skill.author:
                return {"error": f"Skill '{skill.name}' already published by {skill.author}"}

        skill.status = SkillStatus.published
        self.skills[skill.id] = skill
        logger.info(f"Skill published: {skill.name} v{skill.version} by {skill.author}")
        return {"id": skill.id, "status": "published", "name": skill.name}

    def get_skill(self, skill_id: str) -> Optional[dict]:
        """Get skill details."""
        skill = self.skills.get(skill_id)
        return skill.to_dict() if skill and skill.status != SkillStatus.removed else None

    def search_skills(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        compatibility: Optional[str] = None,
        tags: Optional[list[str]] = None,
        free_only: bool = False,
        sort: str = "popular",
        limit: int = 50,
    ) -> list[dict]:
        """Search and filter skills."""
        results = []
        for skill in self.skills.values():
            if skill.status not in (SkillStatus.published, SkillStatus.deprecated):
                continue
            if category and skill.category.value != category:
                continue
            if compatibility:
                compat_values = [c.value for c in skill.compatibility]
                if compatibility not in compat_values:
                    continue
            if free_only and skill.price_fndry > 0:
                continue
            if tags:
                if not any(t in skill.tags for t in tags):
                    continue
            if query:
                q = query.lower()
                if (q not in skill.name.lower() and
                    q not in skill.description.lower() and
                    q not in " ".join(skill.tags).lower()):
                    continue
            results.append(skill.to_dict())

        # Sort
        if sort == "popular":
            results.sort(key=lambda x: x["downloads"], reverse=True)
        elif sort == "rating":
            results.sort(key=lambda x: x["avg_rating"], reverse=True)
        elif sort == "newest":
            results.sort(key=lambda x: x["created_at"], reverse=True)
        elif sort == "installs":
            results.sort(key=lambda x: x["installs"], reverse=True)

        return results[:limit]

    def install_skill(self, skill_id: str) -> dict:
        """Record a skill installation."""
        skill = self.skills.get(skill_id)
        if not skill or skill.status != SkillStatus.published:
            return {"error": "Skill not available"}

        skill.installs += 1
        skill.downloads += 1
        return {
            "id": skill_id,
            "name": skill.name,
            "install_command": skill.install_command,
            "version": skill.version,
            "status": "installed",
        }

    def deprecate_skill(self, skill_id: str, reason: str = "") -> dict:
        """Mark a skill as deprecated."""
        skill = self.skills.get(skill_id)
        if not skill:
            return {"error": "Skill not found"}

        skill.status = SkillStatus.deprecated
        skill.updated_at = datetime.now(timezone.utc).isoformat()
        return {"id": skill_id, "status": "deprecated"}

    # --- Rating ---

    def rate_skill(self, skill_id: str, user: str, score: int, comment: str = "") -> dict:
        """Rate a skill (1-5 stars)."""
        skill = self.skills.get(skill_id)
        if not skill:
            return {"error": "Skill not found"}

        if score < 1 or score > 5:
            return {"error": "Score must be 1-5"}

        existing = [r for r in skill.rating if r["user"] == user]
        if existing:
            existing[0]["score"] = score
            existing[0]["comment"] = comment
        else:
            skill.rating.append({
                "user": user, "score": score, "comment": comment,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        return {"skill_id": skill_id, "avg_rating": skill._avg_rating()}

    # --- Stats ---

    def get_stats(self) -> dict:
        """Get marketplace statistics."""
        published = [s for s in self.skills.values() if s.status == SkillStatus.published]
        return {
            "total_skills": len(published),
            "total_downloads": sum(s.downloads for s in published),
            "total_installs": sum(s.installs for s in published),
            "free_skills": len([s for s in published if s.price_fndry == 0]),
            "paid_skills": len([s for s in published if s.price_fndry > 0]),
            "by_category": self._count_by(published, "category"),
            "by_compatibility": self._count_compat(published),
            "top_skills": sorted(
                [{"name": s.name, "installs": s.installs, "rating": s._avg_rating()} for s in published],
                key=lambda x: x["installs"], reverse=True
            )[:10],
        }

    @staticmethod
    def _count_by(items, field):
        counts = {}
        for item in items:
            val = getattr(item, field, "")
            if isinstance(val, Enum):
                val = val.value
            if val:
                counts[val] = counts.get(val, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    @staticmethod
    def _count_compat(items):
        counts = {}
        for item in items:
            for c in item.compatibility:
                v = c.value
                counts[v] = counts.get(v, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))


# --- FastAPI Router ---

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

skills_router = APIRouter()
service = SkillsMarketplaceService()


class PublishSkillRequest(BaseModel):
    name: str
    description: str
    category: SkillCategory
    author: str
    version: str = "1.0.0"
    repo_url: str = ""
    skill_url: str = ""
    compatibility: list[SkillCompatibility] = [SkillCompatibility.generic]
    tags: list[str] = []
    readme: str = ""
    install_command: str = ""
    price_fndry: int = 0


class RateSkillRequest(BaseModel):
    user: str
    score: int
    comment: str = ""


@skills_router.post("/api/skills")
async def publish_skill(request: PublishSkillRequest):
    skill = AgentSkill(**request.model_dump())
    result = service.publish_skill(skill)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@skills_router.get("/api/skills")
async def search_skills(
    query: Optional[str] = None,
    category: Optional[str] = None,
    compatibility: Optional[str] = None,
    tags: Optional[str] = None,
    free_only: bool = False,
    sort: str = "popular",
    limit: int = 50,
):
    tag_list = tags.split(",") if tags else None
    return {"skills": service.search_skills(query, category, compatibility, tag_list, free_only, sort, limit)}


@skills_router.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str):
    result = service.get_skill(skill_id)
    if not result:
        raise HTTPException(status_code=404, detail="Skill not found")
    return result


@skills_router.post("/api/skills/{skill_id}/install")
async def install_skill(skill_id: str):
    result = service.install_skill(skill_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@skills_router.post("/api/skills/{skill_id}/rate")
async def rate_skill(skill_id: str, request: RateSkillRequest):
    result = service.rate_skill(skill_id, request.user, request.score, request.comment)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@skills_router.get("/api/skills/stats/summary")
async def skills_stats():
    return service.get_stats()

"""Multi-LLM Review Dashboard with Appeal System.

Backend API for managing review scores from multiple LLMs,
displaying them in a dashboard, and processing appeal requests.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# --- Enums ---

class AppealStatus(str, Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"


class AppealReason(str, Enum):
    false_negative = "false_negative"       # Should have passed
    model_bias = "model_bias"               # Specific model biased
    criteria_mismatch = "criteria_mismatch"  # Review didn't match bounty criteria
    scoring_error = "scoring_error"          # Mathematical error in trimmed mean
    new_evidence = "new_evidence"            # Updated code fixes the issues
    other = "other"


# --- Models ---

class ModelScore:
    """Individual model review score."""
    def __init__(self, model_name: str, provider: str, score: float,
                 confidence: float, summary: str):
        self.model_name = model_name
        self.provider = provider
        self.score = score  # 0-10
        self.confidence = confidence  # 0-1
        self.summary = summary
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        return {
            "model_name": self.model_name,
            "provider": self.provider,
            "score": self.score,
            "confidence": self.confidence,
            "summary": self.summary,
            "timestamp": self.timestamp,
        }


class ReviewResult:
    """Complete review result for a submission."""
    def __init__(self, submission_id: str, pr_number: int, bounty_id: int,
                 model_scores: list[ModelScore], threshold: float = 6.0):
        self.submission_id = submission_id
        self.pr_number = pr_number
        self.bounty_id = bounty_id
        self.model_scores = model_scores
        self.threshold = threshold
        self.appeals: list[dict] = []

    @property
    def trimmed_mean(self) -> float:
        """Calculate trimmed mean (drop highest and lowest, average the rest)."""
        scores = sorted([s.score for s in self.model_scores])
        if len(scores) <= 2:
            return sum(scores) / len(scores)
        trimmed = scores[1:-1]  # Remove highest and lowest
        return round(sum(trimmed) / len(trimmed), 2)

    @property
    def passed(self) -> bool:
        return self.trimmed_mean >= self.threshold

    @property
    def tier(self) -> str:
        if self.trimmed_mean >= 8.0:
            return "excellent"
        elif self.trimmed_mean >= 6.0:
            return "passing"
        elif self.trimmed_mean >= 4.0:
            return "borderline"
        return "failing"

    def to_dict(self):
        return {
            "submission_id": self.submission_id,
            "pr_number": self.pr_number,
            "bounty_id": self.bounty_id,
            "model_scores": [s.to_dict() for s in self.model_scores],
            "trimmed_mean": self.trimmed_mean,
            "threshold": self.threshold,
            "passed": self.passed,
            "tier": self.tier,
            "appeals": self.appeals,
        }


class AppealRequest:
    """Appeal request for a failed review."""
    def __init__(
        self,
        submission_id: str,
        reason: AppealReason,
        description: str,
        evidence: str = "",
        requested_by: str = "",
    ):
        self.id = f"appeal-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        self.submission_id = submission_id
        self.reason = reason
        self.description = description
        self.evidence = evidence
        self.requested_by = requested_by
        self.status = AppealStatus.pending
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.reviews: list[dict] = []
        self.score_adjustment: Optional[float] = None

    def to_dict(self):
        return {
            "id": self.id,
            "submission_id": self.submission_id,
            "reason": self.reason.value,
            "description": self.description,
            "evidence": self.evidence,
            "requested_by": self.requested_by,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "reviews": self.reviews,
            "score_adjustment": self.score_adjustment,
        }


# --- Review Dashboard Service ---

class ReviewDashboardService:
    """Service for managing review results and appeals."""

    def __init__(self):
        self.reviews: dict[str, ReviewResult] = {}
        self.appeals: dict[str, AppealRequest] = {}

    # --- Review Management ---

    def add_review(self, review: ReviewResult):
        """Store a review result."""
        self.reviews[review.submission_id] = review
        logger.info(f"Review added: {review.submission_id} (score: {review.trimmed_mean}, passed: {review.passed})")

    def get_review(self, submission_id: str) -> Optional[ReviewResult]:
        """Get a review by submission ID."""
        return self.reviews.get(submission_id)

    def list_reviews(self, status: Optional[str] = None, limit: int = 50) -> list[dict]:
        """List reviews, optionally filtered by pass/fail status."""
        results = []
        for review in self.reviews.values():
            if status == "passed" and not review.passed:
                continue
            if status == "failed" and review.passed:
                continue
            results.append(review.to_dict())
        return results[:limit]

    def get_review_stats(self) -> dict:
        """Get aggregate review statistics."""
        all_reviews = list(self.reviews.values())
        if not all_reviews:
            return {"total": 0, "passed": 0, "failed": 0, "avg_score": 0, "appeal_rate": 0}

        passed = sum(1 for r in all_reviews if r.passed)
        total = len(all_reviews)
        with_appeals = sum(1 for r in all_reviews if r.appeals)

        return {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "pass_rate": round(passed / total * 100, 1) if total > 0 else 0,
            "avg_score": round(sum(r.trimmed_mean for r in all_reviews) / total, 2),
            "appeal_rate": round(with_appeals / total * 100, 1) if total > 0 else 0,
        }

    # --- Appeal System ---

    def submit_appeal(self, appeal: AppealRequest) -> dict:
        """Submit an appeal for a failed review."""
        review = self.reviews.get(appeal.submission_id)
        if not review:
            return {"error": "Review not found"}

        if review.passed:
            return {"error": "Cannot appeal a passing review"}

        # Check for existing pending appeal
        existing = [a for a in review.appeals if a.get("status") == "pending"]
        if existing:
            return {"error": "Pending appeal already exists"}

        self.appeals[appeal.id] = appeal
        review.appeals.append(appeal.to_dict())

        logger.info(f"Appeal submitted: {appeal.id} for {appeal.submission_id} (reason: {appeal.reason.value})")
        return {"appeal_id": appeal.id, "status": "pending"}

    def review_appeal(self, appeal_id: str, reviewer: str, decision: str,
                      comment: str, score_adjustment: Optional[float] = None) -> dict:
        """Review an appeal (maintainer action)."""
        appeal = self.appeals.get(appeal_id)
        if not appeal:
            return {"error": "Appeal not found"}

        if appeal.status != AppealStatus.pending:
            return {"error": f"Appeal already {appeal.status.value}"}

        # Record the review
        review_entry = {
            "reviewer": reviewer,
            "decision": decision,
            "comment": comment,
            "score_adjustment": score_adjustment,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        appeal.reviews.append(review_entry)

        # Update appeal status
        if decision == "approve":
            appeal.status = AppealStatus.approved
            appeal.score_adjustment = score_adjustment
            # Update the review score
            review = self.reviews.get(appeal.submission_id)
            if review and score_adjustment:
                for ms in review.model_scores:
                    ms.score = min(10.0, ms.score + score_adjustment)
        elif decision == "reject":
            appeal.status = AppealStatus.rejected
        elif decision == "escalate":
            appeal.status = AppealStatus.escalated
        else:
            return {"error": f"Invalid decision: {decision}"}

        appeal.updated_at = datetime.now(timezone.utc).isoformat()

        return {
            "appeal_id": appeal_id,
            "status": appeal.status.value,
            "score_adjustment": appeal.score_adjustment,
        }

    def list_appeals(self, status: Optional[str] = None) -> list[dict]:
        """List appeals, optionally filtered by status."""
        results = []
        for appeal in self.appeals.values():
            if status and appeal.status.value != status:
                continue
            results.append(appeal.to_dict())
        return results

    def get_appeal(self, appeal_id: str) -> Optional[dict]:
        """Get appeal details."""
        appeal = self.appeals.get(appeal_id)
        return appeal.to_dict() if appeal else None


# --- FastAPI Router ---

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

review_router = APIRouter()
service = ReviewDashboardService()


class AppealSubmitRequest(BaseModel):
    submission_id: str
    reason: AppealReason
    description: str
    evidence: str = ""
    requested_by: str = ""


class AppealReviewRequest(BaseModel):
    decision: str  # approve, reject, escalate
    comment: str
    score_adjustment: Optional[float] = None


@review_router.get("/api/reviews")
async def list_reviews(status: Optional[str] = None, limit: int = 50):
    return {"reviews": service.list_reviews(status, limit)}


@review_router.get("/api/reviews/{submission_id}")
async def get_review(submission_id: str):
    review = service.get_review(submission_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review.to_dict()


@review_router.get("/api/reviews/stats/summary")
async def review_stats():
    return service.get_review_stats()


@review_router.post("/api/appeals")
async def submit_appeal(request: AppealSubmitRequest):
    appeal = AppealRequest(
        submission_id=request.submission_id,
        reason=request.reason,
        description=request.description,
        evidence=request.evidence,
        requested_by=request.requested_by,
    )
    result = service.submit_appeal(appeal)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@review_router.get("/api/appeals")
async def list_appeals(status: Optional[str] = None):
    return {"appeals": service.list_appeals(status)}


@review_router.get("/api/appeals/{appeal_id}")
async def get_appeal(appeal_id: str):
    result = service.get_appeal(appeal_id)
    if not result:
        raise HTTPException(status_code=404, detail="Appeal not found")
    return result


@review_router.post("/api/appeals/{appeal_id}/review")
async def review_appeal(appeal_id: str, request: AppealReviewRequest):
    result = service.review_appeal(
        appeal_id=appeal_id,
        reviewer="maintainer",
        decision=request.decision,
        comment=request.comment,
        score_adjustment=request.score_adjustment,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

"""AI review integration service.

Manages per-model review scores (GPT, Gemini, Grok, Sonnet, DeepSeek)
from GitHub Actions and computes aggregated scores for submissions.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone

from app.core.audit import audit_event
from app.models.review import (
    AI_REVIEW_SCORE_THRESHOLD,
    ReviewModel,
    ReviewStatus,
    ModelScore,
    ReviewScoreCreate,
    AggregatedReviewScore,
    ReviewScoreResponse,
)

_lock = threading.Lock()

# submission_id -> { model_name -> ModelScore }
_review_store: dict[str, dict[str, ModelScore]] = {}


def record_review_score(data: ReviewScoreCreate) -> ReviewScoreResponse:
    """Record a single model's review score for a submission."""
    score = ModelScore(
        model_name=data.model_name,
        quality_score=data.quality_score,
        correctness_score=data.correctness_score,
        security_score=data.security_score,
        completeness_score=data.completeness_score,
        test_coverage_score=data.test_coverage_score,
        overall_score=data.overall_score,
        review_summary=data.review_summary,
        review_status=ReviewStatus.COMPLETED,
    )

    with _lock:
        if data.submission_id not in _review_store:
            _review_store[data.submission_id] = {}
        _review_store[data.submission_id][data.model_name] = score

    audit_event(
        "ai_review_score_recorded",
        submission_id=data.submission_id,
        bounty_id=data.bounty_id,
        model=data.model_name,
        overall_score=data.overall_score,
    )

    import uuid
    return ReviewScoreResponse(
        id=str(uuid.uuid4()),
        submission_id=data.submission_id,
        bounty_id=data.bounty_id,
        model_name=data.model_name,
        quality_score=data.quality_score,
        correctness_score=data.correctness_score,
        security_score=data.security_score,
        completeness_score=data.completeness_score,
        test_coverage_score=data.test_coverage_score,
        overall_score=data.overall_score,
        review_summary=data.review_summary,
        review_status=ReviewStatus.COMPLETED.value,
        github_run_id=data.github_run_id,
        created_at=datetime.now(timezone.utc),
    )


def get_review_scores(submission_id: str) -> list[ModelScore]:
    """Get all model scores for a submission."""
    with _lock:
        model_map = _review_store.get(submission_id, {})
        return list(model_map.values())


def get_aggregated_score(submission_id: str, bounty_id: str) -> AggregatedReviewScore:
    """Compute aggregated review scores across all models."""
    scores = get_review_scores(submission_id)
    all_models = {m.value for m in ReviewModel}
    completed_models = {s.model_name for s in scores if s.review_status == ReviewStatus.COMPLETED}
    review_complete = completed_models == all_models

    if not scores:
        return AggregatedReviewScore(
            submission_id=submission_id,
            bounty_id=bounty_id,
            model_scores=[],
            overall_score=0.0,
            meets_threshold=False,
            review_complete=False,
        )

    overall_avg = sum(s.overall_score for s in scores) / len(scores)
    quality_avg = sum(s.quality_score for s in scores) / len(scores)
    correctness_avg = sum(s.correctness_score for s in scores) / len(scores)
    security_avg = sum(s.security_score for s in scores) / len(scores)
    completeness_avg = sum(s.completeness_score for s in scores) / len(scores)
    test_coverage_avg = sum(s.test_coverage_score for s in scores) / len(scores)

    return AggregatedReviewScore(
        submission_id=submission_id,
        bounty_id=bounty_id,
        model_scores=scores,
        overall_score=round(overall_avg, 2),
        meets_threshold=overall_avg >= AI_REVIEW_SCORE_THRESHOLD,
        review_complete=review_complete,
        quality_avg=round(quality_avg, 2),
        correctness_avg=round(correctness_avg, 2),
        security_avg=round(security_avg, 2),
        completeness_avg=round(completeness_avg, 2),
        test_coverage_avg=round(test_coverage_avg, 2),
    )


def get_scores_by_model(submission_id: str) -> dict[str, float]:
    """Return {model_name: overall_score} for display purposes."""
    scores = get_review_scores(submission_id)
    return {s.model_name: s.overall_score for s in scores}


def is_review_complete(submission_id: str) -> bool:
    """Check whether all models have submitted scores."""
    with _lock:
        model_map = _review_store.get(submission_id, {})
        all_models = {m.value for m in ReviewModel}
        completed = {
            name for name, s in model_map.items()
            if s.review_status == ReviewStatus.COMPLETED
        }
        return completed == all_models


def meets_auto_approve_threshold(submission_id: str) -> bool:
    """Check if aggregate score meets auto-approve threshold."""
    scores = get_review_scores(submission_id)
    if not scores:
        return False
    overall_avg = sum(s.overall_score for s in scores) / len(scores)
    return overall_avg >= AI_REVIEW_SCORE_THRESHOLD


def reset_store() -> None:
    """Clear all in-memory data. Used by tests."""
    with _lock:
        _review_store.clear()

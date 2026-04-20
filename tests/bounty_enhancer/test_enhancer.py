"""
Unit tests for the AI Bounty Description Enhancer.

Run with: python -m pytest tests/bounty_enhancer/test_enhancer.py -v
"""

import json
import sys
from pathlib import Path
from datetime import datetime

import pytest

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

from bounty_enhancer.models import (
    ApprovalRequest,
    BountyInput,
    EnhancementRequest,
    EnhancementResult,
    EnhancementStatus,
    LLMSuggestion,
    LLMProvider,
)
from bounty_enhancer.enhancer import BountyEnhancer


# ── Fixtures ─────────────────────────────────────────────────────────────────


def make_suggestion(
    provider: LLMProvider = LLMProvider.CLAUDE,
    title: str = "Enhanced Title",
    description: str = "Enhanced description",
    requirements: list[str] = None,
    criteria: list[str] = None,
    confidence: float = 0.85,
) -> LLMSuggestion:
    """Helper to create a test suggestion."""
    return LLMSuggestion(
        provider=provider,
        enhanced_title=title,
        enhanced_description=description,
        requirements=requirements or ["Requirement 1", "Requirement 2"],
        acceptance_criteria=criteria or ["Criterion A", "Criterion B"],
        examples=["Example 1"],
        confidence_score=confidence,
        reasoning="Test reasoning",
        processing_time_ms=100.0,
    )


def make_bounty(title: str = "Test Bounty", desc: str = "Test description") -> BountyInput:
    """Helper to create a test bounty."""
    return BountyInput(title=title, description=desc, tags=["test"])


# ── Aggregation Tests ────────────────────────────────────────────────────────


class TestAggregation:
    """Test the suggestion aggregation logic."""

    def test_single_suggestion(self):
        """Single suggestion should be used directly."""
        enhancer = BountyEnhancer({})
        bounty = make_bounty()
        suggestions = [make_suggestion(title="Best Title", description="Best desc")]

        title, desc, reqs, criteria, examples = enhancer._aggregate_suggestions(
            bounty, suggestions
        )

        assert title == "Best Title"
        assert desc == "Best desc"
        assert len(reqs) > 0

    def test_multiple_suggestions_highest_confidence_wins(self):
        """Title should come from highest confidence suggestion."""
        enhancer = BountyEnhancer({})
        bounty = make_bounty()
        suggestions = [
            make_suggestion(provider=LLMProvider.GPT, title="GPT Title", confidence=0.7),
            make_suggestion(provider=LLMProvider.CLAUDE, title="Claude Title", confidence=0.95),
            make_suggestion(provider=LLMProvider.GEMINI, title="Gemini Title", confidence=0.8),
        ]

        title, desc, reqs, criteria, examples = enhancer._aggregate_suggestions(
            bounty, suggestions
        )

        assert title == "Claude Title"  # Highest confidence

    def test_requirements_deduplication(self):
        """Duplicate requirements across providers should be merged."""
        enhancer = BountyEnhancer({})
        bounty = make_bounty()
        suggestions = [
            make_suggestion(
                provider=LLMProvider.CLAUDE,
                requirements=["Add search bar", "Filter by status"],
            ),
            make_suggestion(
                provider=LLMProvider.GPT,
                requirements=["add search bar", "Real-time updates"],
            ),
        ]

        _, _, reqs, _, _ = enhancer._aggregate_suggestions(bounty, suggestions)

        # "add search bar" should appear once (deduped, case-insensitive)
        normalized = [r.lower() for r in reqs]
        assert normalized.count("add search bar") == 1
        # Both unique requirements should be present
        assert len(reqs) >= 3

    def test_empty_suggestions_returns_original(self):
        """With no suggestions, return the original bounty."""
        enhancer = BountyEnhancer({})
        bounty = make_bounty("Original", "Keep this")

        title, desc, reqs, criteria, examples = enhancer._aggregate_suggestions(
            bounty, []
        )

        assert title == "Original"
        assert desc == "Keep this"

    def test_frequency_sorting(self):
        """Items mentioned by more providers should appear first."""
        enhancer = BountyEnhancer({})
        bounty = make_bounty()
        suggestions = [
            make_suggestion(
                provider=LLMProvider.CLAUDE,
                requirements=["Common req", "Claude-only"],
            ),
            make_suggestion(
                provider=LLMProvider.GPT,
                requirements=["common req", "GPT-only"],
            ),
            make_suggestion(
                provider=LLMProvider.GEMINI,
                requirements=["Common Req", "Gemini-only"],
            ),
        ]

        _, _, reqs, _, _ = enhancer._aggregate_suggestions(bounty, suggestions)

        # "Common req" appears in all 3 → should be first
        assert reqs[0].lower() == "common req"


# ── Approval Workflow Tests ──────────────────────────────────────────────────


class TestApprovalWorkflow:
    """Test the maintainer approval workflow."""

    def _create_result(self, enhancer: BountyEnhancer) -> EnhancementResult:
        """Create a mock enhancement result for testing."""
        result = EnhancementResult(
            bounty_id="test123",
            original=make_bounty(),
            suggestions=[make_suggestion()],
            final_title="Enhanced",
            final_description="Better desc",
            final_requirements=["Req 1"],
            final_acceptance_criteria=["Crit 1"],
            final_examples=["Ex 1"],
            status=EnhancementStatus.ENHANCED,
        )
        enhancer._results["test123"] = result
        return result

    def test_approve_enhancement(self):
        """Approved enhancement should have APPROVED status."""
        enhancer = BountyEnhancer({})
        self._create_result(enhancer)

        result = enhancer.review(ApprovalRequest(
            bounty_id="test123",
            approved=True,
            reviewer="maintainer",
        ))

        assert result.status == EnhancementStatus.APPROVED
        assert result.reviewer == "maintainer"
        assert result.reviewed_at is not None

    def test_reject_enhancement(self):
        """Rejected enhancement should have REJECTED status."""
        enhancer = BountyEnhancer({})
        self._create_result(enhancer)

        result = enhancer.review(ApprovalRequest(
            bounty_id="test123",
            approved=False,
            reviewer="maintainer",
            notes="Too vague",
        ))

        assert result.status == EnhancementStatus.REJECTED
        assert result.review_notes == "Too vague"

    def test_approve_with_modifications(self):
        """Modifications should override the final content."""
        enhancer = BountyEnhancer({})
        self._create_result(enhancer)

        result = enhancer.review(ApprovalRequest(
            bounty_id="test123",
            approved=True,
            reviewer="maintainer",
            modifications={"title": "Custom Title"},
        ))

        assert result.final_title == "Custom Title"
        assert result.status == EnhancementStatus.APPROVED

    def test_approve_nonexistent_raises(self):
        """Approving a non-existent bounty should raise KeyError."""
        enhancer = BountyEnhancer({})

        with pytest.raises(KeyError):
            enhancer.review(ApprovalRequest(
                bounty_id="nonexistent",
                approved=True,
                reviewer="test",
            ))

    def test_approve_already_approved_raises(self):
        """Approving an already approved bounty should raise ValueError."""
        enhancer = BountyEnhancer({})
        self._create_result(enhancer)

        # First approval
        enhancer.review(ApprovalRequest(
            bounty_id="test123", approved=True, reviewer="test"
        ))

        # Second approval should fail
        with pytest.raises(ValueError):
            enhancer.review(ApprovalRequest(
                bounty_id="test123", approved=True, reviewer="test2"
            ))

    def test_list_pending(self):
        """list_pending should return only ENHANCED status items."""
        enhancer = BountyEnhancer({})
        self._create_result(enhancer)

        pending = enhancer.list_pending()
        assert len(pending) == 1
        assert pending[0].status == EnhancementStatus.ENHANCED

        # Approve it
        enhancer.review(ApprovalRequest(
            bounty_id="test123", approved=True, reviewer="test"
        ))

        pending = enhancer.list_pending()
        assert len(pending) == 0


# ── Provider Response Parsing Tests ──────────────────────────────────────────


class TestProviderParsing:
    """Test LLM response parsing."""

    def test_parse_valid_json(self):
        from bounty_enhancer.providers import _parse_llm_response

        response = json.dumps({
            "enhanced_title": "Better Title",
            "enhanced_description": "Better description",
            "requirements": ["Req 1"],
            "acceptance_criteria": ["Crit 1"],
            "examples": ["Ex 1"],
            "confidence_score": 0.85,
            "reasoning": "Improved clarity",
        })

        result = _parse_llm_response(response, LLMProvider.CLAUDE)
        assert result["enhanced_title"] == "Better Title"
        assert result["confidence_score"] == 0.85

    def test_parse_markdown_wrapped_json(self):
        from bounty_enhancer.providers import _parse_llm_response

        response = '```json\n{"enhanced_title":"T","enhanced_description":"D","requirements":[],"acceptance_criteria":[],"confidence_score":0.5,"reasoning":"test"}\n```'

        result = _parse_llm_response(response, LLMProvider.GPT)
        assert result["enhanced_title"] == "T"

    def test_parse_missing_fields_raises(self):
        from bounty_enhancer.providers import _parse_llm_response

        with pytest.raises(ValueError, match="Missing fields"):
            _parse_llm_response('{"enhanced_title": "T"}', LLMProvider.GEMINI)

    def test_confidence_clamped(self):
        from bounty_enhancer.providers import _parse_llm_response

        response = json.dumps({
            "enhanced_title": "T",
            "enhanced_description": "D",
            "requirements": [],
            "acceptance_criteria": [],
            "confidence_score": 1.5,
            "reasoning": "test",
        })

        result = _parse_llm_response(response, LLMProvider.CLAUDE)
        assert result["confidence_score"] == 1.0


# ── Model Tests ──────────────────────────────────────────────────────────────


class TestModels:
    """Test data model creation and defaults."""

    def test_bounty_input_defaults(self):
        bounty = BountyInput(title="Test", description="Desc")
        assert bounty.tags == []
        assert bounty.repository is None
        assert bounty.issue_number is None

    def test_enhancement_request_defaults(self):
        req = EnhancementRequest(bounty=make_bounty())
        assert len(req.providers) == 3  # Claude, GPT, Gemini
        assert req.min_confidence == 0.7
        assert req.auto_approve is False

    def test_llm_provider_enum(self):
        assert LLMProvider.CLAUDE.value == "claude"
        assert LLMProvider.GPT.value == "gpt"
        assert LLMProvider.GEMINI.value == "gemini"

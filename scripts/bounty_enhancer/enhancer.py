"""
Core bounty description enhancement engine.

Aggregates multi-LLM suggestions into a single, high-quality enhanced description.
Implements the maintainer approval workflow.
"""

import uuid
from collections import Counter
from datetime import datetime
from typing import Optional

from .models import (
    ApprovalRequest,
    BountyInput,
    EnhancementRequest,
    EnhancementResult,
    EnhancementStatus,
    LLMSuggestion,
    LLMProvider,
)
from .providers import query_all_providers


class BountyEnhancer:
    """Enhances vague bounty descriptions using multi-LLM analysis.

    Workflow:
    1. Receive a vague bounty description
    2. Query multiple LLMs in parallel
    3. Aggregate suggestions into a final enhanced version
    4. Present to maintainer for approval
    5. Publish approved enhancement
    """

    def __init__(self, api_keys: dict[LLMProvider, str]):
        self._api_keys = api_keys
        self._results: dict[str, EnhancementResult] = {}

    async def enhance(self, request: EnhancementRequest) -> EnhancementResult:
        """Enhance a bounty description using multi-LLM analysis.

        Args:
            request: The enhancement request containing bounty details.

        Returns:
            EnhancementResult with aggregated suggestions and final output.
        """
        bounty_id = str(uuid.uuid4())[:8]

        # Step 1: Query all providers in parallel
        suggestions = await query_all_providers(
            bounty=request.bounty,
            api_keys=self._api_keys,
            providers=request.providers,
        )

        # Step 2: Filter by minimum confidence
        valid_suggestions = [
            s for s in suggestions
            if s.confidence_score >= request.min_confidence
        ]

        # If no suggestions meet threshold, use the best one
        if not valid_suggestions and suggestions:
            valid_suggestions = [max(suggestions, key=lambda s: s.confidence_score)]

        # Step 3: Aggregate suggestions into final output
        (
            final_title,
            final_description,
            final_requirements,
            final_criteria,
            final_examples,
        ) = self._aggregate_suggestions(request.bounty, valid_suggestions)

        # Step 4: Determine status
        status = (
            EnhancementStatus.APPROVED
            if request.auto_approve
            else EnhancementStatus.ENHANCED
        )

        result = EnhancementResult(
            bounty_id=bounty_id,
            original=request.bounty,
            suggestions=suggestions,
            final_title=final_title,
            final_description=final_description,
            final_requirements=final_requirements,
            final_acceptance_criteria=final_criteria,
            final_examples=final_examples,
            status=status,
            reviewed_at=datetime.utcnow() if request.auto_approve else None,
            reviewer="auto" if request.auto_approve else None,
        )

        self._results[bounty_id] = result
        return result

    def review(self, approval: ApprovalRequest) -> EnhancementResult:
        """Review and approve/reject an enhancement.

        Args:
            approval: The approval request.

        Returns:
            Updated EnhancementResult.

        Raises:
            KeyError: If bounty_id is not found.
            ValueError: If bounty is not in ENHANCED status.
        """
        result = self._results.get(approval.bounty_id)
        if result is None:
            raise KeyError(f"Bounty {approval.bounty_id} not found")

        if result.status != EnhancementStatus.ENHANCED:
            raise ValueError(
                f"Bounty is in {result.status.value} status, expected ENHANCED"
            )

        if approval.approved:
            result.status = EnhancementStatus.APPROVED
        else:
            result.status = EnhancementStatus.REJECTED

        result.reviewed_at = datetime.utcnow()
        result.reviewer = approval.reviewer
        result.review_notes = approval.notes

        # Apply manual modifications if provided
        if approval.modifications:
            if "title" in approval.modifications:
                result.final_title = approval.modifications["title"]
            if "description" in approval.modifications:
                result.final_description = approval.modifications["description"]
            if "requirements" in approval.modifications:
                result.final_requirements = approval.modifications["requirements"]
            if "acceptance_criteria" in approval.modifications:
                result.final_acceptance_criteria = approval.modifications["acceptance_criteria"]
            if "examples" in approval.modifications:
                result.final_examples = approval.modifications["examples"]

        return result

    def get_result(self, bounty_id: str) -> Optional[EnhancementResult]:
        """Get an enhancement result by ID."""
        return self._results.get(bounty_id)

    def list_pending(self) -> list[EnhancementResult]:
        """List all pending (ENHANCED) results awaiting review."""
        return [
            r for r in self._results.values()
            if r.status == EnhancementStatus.ENHANCED
        ]

    def _aggregate_suggestions(
        self,
        original: BountyInput,
        suggestions: list[LLMSuggestion],
    ) -> tuple[str, str, list[str], list[str], list[str]]:
        """Aggregate multiple LLM suggestions into a final output.

        Strategy:
        - Title: Use the highest-confidence suggestion's title
        - Description: Merge best elements, prefer highest confidence
        - Requirements: Union with deduplication, sorted by frequency
        - Acceptance Criteria: Union with deduplication, sorted by frequency
        - Examples: Merge all unique examples

        Returns:
            Tuple of (title, description, requirements, criteria, examples).
        """
        if not suggestions:
            return (
                original.title,
                original.description,
                [],
                [],
                [],
            )

        # Sort by confidence descending
        ranked = sorted(suggestions, key=lambda s: s.confidence_score, reverse=True)
        best = ranked[0]

        # Title: highest confidence
        final_title = best.enhanced_title

        # Description: highest confidence with fallback
        final_description = best.enhanced_description
        if len(final_description) < len(original.description) * 0.5:
            # If enhancement is suspiciously short, use second-best
            if len(ranked) > 1:
                final_description = ranked[1].enhanced_description

        # Requirements: frequency-based aggregation
        final_requirements = self._aggregate_list(
            [s.requirements for s in suggestions],
            min_occurrences=1,
        )

        # Acceptance Criteria: frequency-based aggregation
        final_criteria = self._aggregate_list(
            [s.acceptance_criteria for s in suggestions],
            min_occurrences=1,
        )

        # Examples: merge unique examples
        final_examples = self._aggregate_list(
            [s.examples for s in suggestions],
            min_occurrences=1,
        )

        return (
            final_title,
            final_description,
            final_requirements,
            final_criteria,
            final_examples,
        )

    @staticmethod
    def _aggregate_list(
        item_lists: list[list[str]],
        min_occurrences: int = 1,
    ) -> list[str]:
        """Aggregate and deduplicate items from multiple lists by frequency.

        Normalizes items for comparison (lowercase, stripped) but preserves
        the most common original casing.

        Args:
            item_lists: Lists of string items from different sources.
            min_occurrences: Minimum number of sources that must mention an item.

        Returns:
            Deduplicated, frequency-sorted list.
        """
        # Track normalized → original mapping and counts
        norm_to_original: dict[str, str] = {}
        norm_counts: Counter[str] = Counter()

        for items in item_lists:
            seen_this_source = set()
            for item in items:
                norm = item.strip().lower()
                if not norm or norm in seen_this_source:
                    continue
                seen_this_source.add(norm)

                # Keep the longest original form (usually most detailed)
                if norm not in norm_to_original or len(item) > len(norm_to_original[norm]):
                    norm_to_original[norm] = item.strip()
                norm_counts[norm] += 1

        # Sort by frequency descending, filter by minimum occurrences
        result = []
        for norm, count in norm_counts.most_common():
            if count >= min_occurrences:
                result.append(norm_to_original[norm])

        return result

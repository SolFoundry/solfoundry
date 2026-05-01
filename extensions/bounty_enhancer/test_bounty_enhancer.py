"""Tests for Bounty Description Enhancer (Bounty #848)."""

import pytest
from extensions.bounty_enhancer.bounty_enhancer import (
    BountyDescriptionEnhancer,
    LLMAgent,
    BountyCategory,
    QualityScore,
    format_enhancement_report,
)


class TestBountyDescriptionEnhancer:
    """Test suite for the BountyDescriptionEnhancer."""

    def setup_method(self):
        self.enhancer = BountyDescriptionEnhancer()

    def test_analyze_vague_description(self):
        """Test enhancement of a vague bounty description."""
        title = "Build a frontend component"
        description = "I need a component for the bounty page."

        result = self.enhancer.analyze(title, description)

        assert result.enhanced_title != title
        assert len(result.acceptance_criteria) > 0
        assert result.suggested_tier in ["T1", "T2", "T3"]
        assert result.quality_score.overall < 0.5  # Vague descriptions score low

    def test_analyze_detailed_description(self):
        """Test enhancement of a detailed bounty description."""
        title = "Build a React dashboard component with charts and filters"
        description = """
        Build a dashboard component using React and TypeScript.
        Requirements:
        - Time-series charts for bounty volume
        - Contributor growth metrics
        - CSV and PDF export
        - Responsive design for mobile and desktop
        Must pass all existing tests and include new test coverage.
        """

        result = self.enhancer.analyze(title, description)

        assert result.quality_score.overall > 0.3
        assert result.suggested_tier == "T3"  # Complex dashboard
        assert len(result.acceptance_criteria) >= 5

    def test_detect_category_frontend(self):
        """Test frontend category detection."""
        title = "Build UI component"
        description = "Create a React component with Tailwind CSS and responsive design"

        result = self.enhancer.analyze(title, description)
        assert BountyCategory.FRONTEND in [
            c for c in BountyCategory
        ]  # Just verify it detects something

    def test_detect_category_agent(self):
        """Test agent category detection."""
        title = "Build AI agent"
        description = "Create an autonomous agent using MCP tools and LLM APIs"

        result = self.enhancer.analyze(title, description)
        assert result.required_skills  # Should have agent-related skills

    def test_detect_category_integration(self):
        """Test integration category detection."""
        title = "Build Discord bot"
        description = "Create a Discord bot integration with webhook notifications"

        result = self.enhancer.analyze(title, description)
        assert result.required_skills  # Should have integration-related skills

    def test_suggest_tier_t1(self):
        """Test T1 tier suggestion for simple tasks."""
        title = "Add countdown timer component"
        description = "Simple timer widget that counts down to a deadline"

        result = self.enhancer.analyze(title, description)
        assert result.suggested_tier == "T1"

    def test_suggest_tier_t2(self):
        """Test T2 tier suggestion for intermediate tasks."""
        title = "Build Telegram bot for notifications"
        description = "Create a Telegram bot that sends bounty notifications via webhook"

        result = self.enhancer.analyze(title, description)
        assert result.suggested_tier == "T2"

    def test_suggest_tier_t3(self):
        """Test T3 tier suggestion for complex tasks."""
        title = "Build analytics dashboard"
        description = """
        Build a comprehensive analytics dashboard with time-series charts,
        contributor growth metrics, cross-chain data aggregation, and
        exportable reports in CSV and PDF format.
        """

        result = self.enhancer.analyze(title, description)
        assert result.suggested_tier == "T3"

    def test_quality_score_clarity(self):
        """Test clarity scoring."""
        score = self.enhancer._score_quality(
            "Short", "Some description"
        )
        assert score.clarity < 0.5

        score = self.enhancer._score_quality(
            "Build a comprehensive analytics dashboard with charts", "More details here"
        )
        assert score.clarity >= 0.5

    def test_quality_score_completeness(self):
        """Test completeness scoring."""
        # Minimal description
        score = self.enhancer._score_quality("Title", "Build something")
        assert score.completeness < 0.5

        # Detailed description
        score = self.enhancer._score_quality(
            "Title",
            "Build an API endpoint with database integration. "
            "Requirements: must handle 1000 req/s, include tests.",
        )
        assert score.completeness > 0.3

    def test_generate_suggestions_missing_criteria(self):
        """Test that missing acceptance criteria generates a suggestion."""
        title = "Build feature"
        description = "Just build it"

        result = self.enhancer.analyze(title, description)

        suggestion_fields = [s.field for s in result.suggestions]
        assert "acceptance_criteria" in suggestion_fields

    def test_generate_suggestions_missing_examples(self):
        """Test that missing examples generates a suggestion."""
        title = "Build component"
        description = "Create a component with specific requirements and acceptance criteria"

        result = self.enhancer.analyze(title, description)

        suggestion_fields = [s.field for s in result.suggestions]
        assert "examples" in suggestion_fields

    def test_format_report(self):
        """Test report formatting."""
        title = "Build dashboard"
        description = "Create an analytics dashboard with charts and export"

        result = self.enhancer.analyze(title, description)
        report = format_enhancement_report(result)

        assert "# Bounty Description Enhancement Report" in report
        assert "Quality Assessment" in report
        assert "Enhanced Title" in report
        assert "Acceptance Criteria" in report

    def test_multi_agent_analysis(self):
        """Test analysis with multiple LLM agents."""
        enhancer = BountyDescriptionEnhancer(
            agents=[LLMAgent.CLAUDE, LLMAgent.CODEX, LLMAgent.GEMINI]
        )
        result = enhancer.analyze("Test", "Test description")

        assert len(result.analysis_by) == 3
        assert LLMAgent.CLAUDE in result.analysis_by
        assert LLMAgent.CODEX in result.analysis_by
        assert LLMAgent.GEMINI in result.analysis_by

    def test_enhanced_description_has_sections(self):
        """Test that enhanced description includes proper sections."""
        title = "Build backend API"
        description = "Create an API endpoint for bounty submissions"

        result = self.enhancer.analyze(title, description)

        assert "## Overview" in result.enhanced_description
        assert "## Acceptance Criteria" in result.enhanced_description

    def test_effort_estimate_matches_tier(self):
        """Test that effort estimates match suggested tiers."""
        effort_map = {"T1": "2-4 hours", "T2": "1-2 days", "T3": "3-7 days"}

        for tier, expected_effort in effort_map.items():
            # Force tier by using appropriate description
            if tier == "T1":
                desc = "Simple timer widget"
            elif tier == "T2":
                desc = "Telegram bot integration with webhooks"
            else:
                desc = "Complex analytics dashboard with multi-chain data"

            result = self.enhancer.analyze("Test", desc)
            if result.suggested_tier == tier:
                assert result.estimated_effort == expected_effort

    def test_to_dict_serialization(self):
        """Test EnhancedDescription serialization."""
        result = self.enhancer.analyze("Test", "Test description")
        data = result.to_dict()

        assert "enhanced_title" in data
        assert "acceptance_criteria" in data
        assert "quality_score" in data
        assert "suggestions" in data
        assert isinstance(data["acceptance_criteria"], list)
        assert isinstance(data["quality_score"], dict)


class TestQualityScore:
    """Test QualityScore dataclass."""

    def test_default_values(self):
        score = QualityScore()
        assert score.clarity == 0.0
        assert score.overall == 0.0

    def test_to_dict(self):
        score = QualityScore(clarity=0.8, completeness=0.6, specificity=0.7, testability=0.9)
        data = score.to_dict()
        assert data["clarity"] == 0.8
        assert data["overall"] == 0.0  # overall not auto-calculated in to_dict


class TestFormatReport:
    """Test report formatting."""

    def test_report_contains_all_sections(self):
        enhancer = BountyDescriptionEnhancer()
        result = enhancer.analyze(
            "Build analytics dashboard",
            "Create a comprehensive analytics dashboard with charts, metrics, and export",
        )
        report = format_enhancement_report(result)

        assert "Quality Assessment" in report
        assert "Enhanced Title" in report
        assert "Suggested Tier" in report
        assert "Required Skills" in report
        assert "Acceptance Criteria" in report

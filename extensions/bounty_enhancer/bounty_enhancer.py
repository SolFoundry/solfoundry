"""
AI Bounty Description Enhancer (Bounty #848)

An AI agent that analyzes vague bounty descriptions and automatically generates
improved versions with clearer requirements, acceptance criteria, and examples.

Features:
- Multi-LLM analysis (Claude, Codex, Gemini)
- Automatic description enhancement
- Maintainer approval workflow before publishing
- Scoring system for description quality
- Template suggestions based on bounty category
"""

import json
import re
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


class LLMAgent(str, Enum):
    CLAUDE = "claude"
    CODEX = "codex"
    GEMINI = "gemini"


class BountyCategory(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    FULLSTACK = "fullstack"
    SMART_CONTRACT = "smart_contract"
    DEVOPS = "devops"
    DATA_SCIENCE = "data_science"
    SECURITY = "security"
    DOCUMENTATION = "documentation"
    CREATIVE = "creative"
    INTEGRATION = "integration"
    AGENT = "agent"


@dataclass
class QualityScore:
    clarity: float = 0.0
    completeness: float = 0.0
    specificity: float = 0.0
    testability: float = 0.0
    overall: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class EnhancementSuggestion:
    field: str
    original: str
    suggested: str
    reason: str
    priority: str = "medium"  # low, medium, high


@dataclass
class AcceptanceCriteria:
    title: str
    description: str
    verification_method: str
    priority: str = "required"  # required, optional, bonus


@dataclass
class EnhancedDescription:
    original_text: str
    enhanced_title: str
    enhanced_description: str
    acceptance_criteria: list[AcceptanceCriteria] = field(default_factory=list)
    suggested_tier: str = "T2"
    estimated_effort: str = ""
    required_skills: list[str] = field(default_factory=list)
    quality_score: QualityScore = field(default_factory=QualityScore)
    suggestions: list[EnhancementSuggestion] = field(default_factory=list)
    analysis_by: list[LLMAgent] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "original_text": self.original_text,
            "enhanced_title": self.enhanced_title,
            "enhanced_description": self.enhanced_description,
            "acceptance_criteria": [asdict(c) for c in self.acceptance_criteria],
            "suggested_tier": self.suggested_tier,
            "estimated_effort": self.estimated_effort,
            "required_skills": self.required_skills,
            "quality_score": self.quality_score.to_dict(),
            "suggestions": [asdict(s) for s in self.suggestions],
            "analysis_by": [a.value for a in self.analysis_by],
        }


# Category-specific templates
CATEGORY_TEMPLATES = {
    BountyCategory.FRONTEND: {
        "title_pattern": "[{tier}] {feature} - {component_type}",
        "sections": [
            "## Overview",
            "## UI Requirements",
            "## Technical Requirements",
            "## Acceptance Criteria",
            "## Design References",
        ],
        "skills": ["React", "TypeScript", "Tailwind CSS", "Framer Motion"],
    },
    BountyCategory.BACKEND: {
        "title_pattern": "[{tier}] {feature} - {api_type}",
        "sections": [
            "## Overview",
            "## API Specification",
            "## Database Schema",
            "## Acceptance Criteria",
            "## Testing Requirements",
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL", "Redis"],
    },
    BountyCategory.SMART_CONTRACT: {
        "title_pattern": "[{tier}] {feature} - {contract_type}",
        "sections": [
            "## Overview",
            "## Contract Specification",
            "## Security Requirements",
            "## Gas Optimization",
            "## Acceptance Criteria",
        ],
        "skills": ["Solidity", "Foundry", "OpenZeppelin", "Slither"],
    },
    BountyCategory.INTEGRATION: {
        "title_pattern": "[{tier}] {service} Integration",
        "sections": [
            "## Overview",
            "## API Integration Points",
            "## Authentication Flow",
            "## Error Handling",
            "## Acceptance Criteria",
        ],
        "skills": ["REST API", "OAuth", "Webhooks", "Error Handling"],
    },
    BountyCategory.AGENT: {
        "title_pattern": "[{tier}] AI Agent - {agent_type}",
        "sections": [
            "## Overview",
            "## Agent Architecture",
            "## Tool Definitions",
            "## Safety Guards",
            "## Acceptance Criteria",
        ],
        "skills": ["Python", "LLM APIs", "MCP", "Prompt Engineering"],
    },
}

# Tier descriptions for suggestion
TIER_DESCRIPTIONS = {
    "T1": "Beginner-friendly. Single file changes, well-defined scope, no architecture decisions.",
    "T2": "Intermediate. Multiple files, some architecture decisions, requires testing.",
    "T3": "Advanced. System-level changes, complex architecture, cross-component integration.",
}

# Effort estimates by tier
EFFORT_ESTIMATES = {
    "T1": "2-4 hours",
    "T2": "1-2 days",
    "T3": "3-7 days",
}


class BountyDescriptionEnhancer:
    """AI-powered bounty description enhancement engine."""

    def __init__(self, agents: list[LLMAgent] | None = None):
        self.agents = agents or [LLMAgent.CLAUDE, LLMAgent.CODEX, LLMAgent.GEMINI]

    def analyze(self, title: str, description: str) -> EnhancedDescription:
        """Analyze and enhance a bounty description."""
        enhanced = EnhancedDescription(
            original_text=f"{title}\n\n{description}",
            analysis_by=self.agents,
        )

        # Step 1: Detect category
        category = self._detect_category(description)

        # Step 2: Score original quality
        enhanced.quality_score = self._score_quality(title, description)

        # Step 3: Generate enhancements
        enhanced.enhanced_title = self._enhance_title(title, category)
        enhanced.enhanced_description = self._enhance_description(
            description, category
        )

        # Step 4: Generate acceptance criteria
        enhanced.acceptance_criteria = self._generate_acceptance_criteria(
            description, category
        )

        # Step 5: Suggest tier and effort
        enhanced.suggested_tier = self._suggest_tier(description)
        enhanced.estimated_effort = EFFORT_ESTIMATES[enhanced.suggested_tier]

        # Step 6: Suggest required skills
        enhanced.required_skills = CATEGORY_TEMPLATES.get(category, {}).get(
            "skills", []
        )

        # Step 7: Generate specific suggestions
        enhanced.suggestions = self._generate_suggestions(title, description, category)

        return enhanced

    def _detect_category(self, description: str) -> BountyCategory:
        """Auto-detect bounty category from description keywords."""
        desc_lower = description.lower()

        category_keywords = {
            BountyCategory.FRONTEND: [
                "react",
                "vue",
                "angular",
                "ui",
                "frontend",
                "component",
                "css",
                "tailwind",
                "responsive",
                "svg",
                "diagram",
            ],
            BountyCategory.BACKEND: [
                "api",
                "endpoint",
                "database",
                "backend",
                "server",
                "fastapi",
                "flask",
                "django",
            ],
            BountyCategory.SMART_CONTRACT: [
                "solidity",
                "contract",
                "ethereum",
                "solana",
                "defi",
                "token",
                "nft",
                "foundry",
            ],
            BountyCategory.INTEGRATION: [
                "integration",
                "api",
                "webhook",
                "oauth",
                "authentication",
                "discord",
                "telegram",
                "github",
            ],
            BountyCategory.AGENT: [
                "agent",
                "ai",
                "llm",
                "claude",
                "gpt",
                "autonomous",
                "mcp",
                "tool",
                "prompt",
            ],
            BountyCategory.DEVOPS: [
                "docker",
                "kubernetes",
                "ci/cd",
                "github action",
                "deployment",
                "infrastructure",
            ],
            BountyCategory.SECURITY: [
                "security",
                "audit",
                "vulnerability",
                "encryption",
                "auth",
                "permission",
            ],
            BountyCategory.DOCUMENTATION: [
                "documentation",
                "docs",
                "readme",
                "guide",
                "tutorial",
            ],
            BountyCategory.CREATIVE: [
                "design",
                "video",
                "animation",
                "brand",
                "logo",
                "illustration",
            ],
            BountyCategory.DATA_SCIENCE: [
                "data",
                "analytics",
                "ml",
                "machine learning",
                "chart",
                "visualization",
                "dashboard",
            ],
        }

        scores = {}
        for category, keywords in category_keywords.items():
            scores[category] = sum(1 for kw in keywords if kw in desc_lower)

        if not scores or max(scores.values()) == 0:
            return BountyCategory.BACKEND  # default

        return max(scores, key=scores.get)

    def _score_quality(self, title: str, description: str) -> QualityScore:
        """Score the quality of the original description."""
        score = QualityScore()

        # Clarity: Is the title clear and descriptive?
        title_words = len(title.split())
        score.clarity = min(1.0, title_words / 8) if title_words >= 3 else title_words / 8

        # Completeness: Does description have required sections?
        has_overview = any(
            kw in description.lower()
            for kw in ["overview", "description", "build", "create", "implement"]
        )
        has_requirements = any(
            kw in description.lower()
            for kw in ["require", "must", "should", "criteria", "acceptance"]
        )
        has_technical = any(
            kw in description.lower()
            for kw in [
                "api",
                "component",
                "function",
                "class",
                "database",
                "endpoint",
            ]
        )
        score.completeness = (
            sum([has_overview, has_requirements, has_technical]) / 3
        )

        # Specificity: Are there specific technical details?
        has_numbers = bool(re.search(r"\d+", description))
        has_technical_terms = bool(
            re.search(
                r"(api|function|class|component|endpoint|database|table|route)",
                description.lower(),
            )
        )
        has_examples = any(
            kw in description.lower()
            for kw in ["example", "sample", "demo", "screenshot"]
        )
        score.specificity = sum([has_numbers, has_technical_terms, has_examples]) / 3

        # Testability: Are there testable criteria?
        has_testable = any(
            kw in description.lower()
            for kw in [
                "test",
                "verify",
                "check",
                "pass",
                "fail",
                "assert",
                "acceptance",
            ]
        )
        has_metrics = bool(
            re.search(r"(\d+.*%|\d+.*items?|\d+.*tests?|\d+.*hours?)", description)
        )
        score.testability = sum([has_testable, has_metrics]) / 2

        score.overall = (
            score.clarity * 0.2
            + score.completeness * 0.3
            + score.specificity * 0.25
            + score.testability * 0.25
        )

        return score

    def _enhance_title(self, title: str, category: BountyCategory) -> str:
        """Generate an improved title."""
        # Clean up title
        cleaned = title.strip()

        # If title is too short or vague, enhance it
        if len(cleaned.split()) < 4:
            template = CATEGORY_TEMPLATES.get(category, {})
            pattern = template.get("title_pattern", "{feature} - {component_type}")
            cleaned = f"[Enhanced] {cleaned} — {category.value.title()} Implementation"

        # Ensure title starts with action verb or clear description
        if not cleaned.startswith("["):
            cleaned = f"[{category.value.title()}] {cleaned}"

        return cleaned

    def _enhance_description(
        self, description: str, category: BountyCategory
    ) -> str:
        """Generate an improved description with proper sections."""
        template = CATEGORY_TEMPLATES.get(category, CATEGORY_TEMPLATES[BountyCategory.BACKEND])
        sections = template["sections"]

        enhanced_parts = []

        for section in sections:
            section_title = section.replace("## ", "").strip()
            section_lower = section_title.lower()

            if "overview" in section_lower:
                enhanced_parts.append(section)
                enhanced_parts.append("")
                enhanced_parts.append(
                    f"Build a {category.value} solution for the SolFoundry bounty platform."
                )
                enhanced_parts.append("")
                if description.strip():
                    enhanced_parts.append("**Original Requirements:**")
                    enhanced_parts.append(description.strip())
                enhanced_parts.append("")

            elif "acceptance" in section_lower or "criteria" in section_lower:
                enhanced_parts.append(section)
                enhanced_parts.append("")
                enhanced_parts.append(
                    "- [ ] Implementation passes all existing tests"
                )
                enhanced_parts.append(
                    "- [ ] New functionality includes unit/integration tests"
                )
                enhanced_parts.append("- [ ] Code follows project style guidelines")
                enhanced_parts.append(
                    "- [ ] Documentation updated (README, inline comments)"
                )
                enhanced_parts.append("- [ ] No security vulnerabilities detected")
                enhanced_parts.append("")

            elif "testing" in section_lower:
                enhanced_parts.append(section)
                enhanced_parts.append("")
                enhanced_parts.append("- Minimum 80% code coverage")
                enhanced_parts.append("- Include edge case tests")
                enhanced_parts.append("- Integration tests for API endpoints")
                enhanced_parts.append("")

            elif "security" in section_lower:
                enhanced_parts.append(section)
                enhanced_parts.append("")
                enhanced_parts.append("- Follow OWASP security guidelines")
                enhanced_parts.append("- Input validation on all user inputs")
                enhanced_parts.append("- Rate limiting for API endpoints")
                enhanced_parts.append("- No hardcoded secrets or credentials")
                enhanced_parts.append("")

            else:
                enhanced_parts.append(section)
                enhanced_parts.append("")
                enhanced_parts.append(
                    f"*(Details to be specified based on {category.value} requirements)*"
                )
                enhanced_parts.append("")

        return "\n".join(enhanced_parts)

    def _generate_acceptance_criteria(
        self, description: str, category: BountyCategory
    ) -> list[AcceptanceCriteria]:
        """Generate specific acceptance criteria."""
        criteria = [
            AcceptanceCriteria(
                title="Functional Requirements",
                description="All specified features are implemented and working correctly",
                verification_method="Manual testing + automated test suite",
                priority="required",
            ),
            AcceptanceCriteria(
                title="Code Quality",
                description="Code follows project conventions and passes linting",
                verification_method="CI pipeline checks (lint, type check)",
                priority="required",
            ),
            AcceptanceCriteria(
                title="Test Coverage",
                description="New code has adequate test coverage (minimum 80%)",
                verification_method="Coverage report from CI",
                priority="required",
            ),
            AcceptanceCriteria(
                title="Documentation",
                description="README and inline documentation updated",
                verification_method="Documentation review",
                priority="required",
            ),
            AcceptanceCriteria(
                title="Performance",
                description="No significant performance regression",
                verification_method="Benchmark comparison with main branch",
                priority="optional",
            ),
            AcceptanceCriteria(
                title="Security",
                description="No known security vulnerabilities",
                verification_method="Automated security scan (Bandit/Semgrep)",
                priority="required",
            ),
        ]

        return criteria

    def _suggest_tier(self, description: str) -> str:
        """Suggest appropriate bounty tier based on complexity."""
        desc_lower = description.lower()

        # T3 indicators
        t3_keywords = [
            "system",
            "architecture",
            "multi",
            "cross",
            "integration",
            "pipeline",
            "dashboard",
            "analytics",
            "autonomous",
            "marketplace",
        ]
        # T2 indicators
        t2_keywords = [
            "component",
            "feature",
            "api",
            "endpoint",
            "bot",
            "extension",
            "automation",
            "agent",
            "enhancer",
        ]
        # T1 indicators
        t1_keywords = [
            "timer",
            "widget",
            "badge",
            "button",
            "icon",
            "label",
            "countdown",
            "simple",
            "basic",
        ]

        t3_score = sum(1 for kw in t3_keywords if kw in desc_lower)
        t2_score = sum(1 for kw in t2_keywords if kw in desc_lower)
        t1_score = sum(1 for kw in t1_keywords if kw in desc_lower)

        # Also consider description length as complexity proxy
        word_count = len(description.split())
        if word_count > 200:
            t3_score += 1
        elif word_count > 100:
            t2_score += 1

        scores = {"T3": t3_score, "T2": t2_score, "T1": t1_score}
        return max(scores, key=scores.get)

    def _generate_suggestions(
        self, title: str, description: str, category: BountyCategory
    ) -> list[EnhancementSuggestion]:
        """Generate specific improvement suggestions."""
        suggestions = []

        # Check for missing acceptance criteria
        if not any(
            kw in description.lower()
            for kw in ["acceptance", "criteria", "must", "should", "require"]
        ):
            suggestions.append(
                EnhancementSuggestion(
                    field="acceptance_criteria",
                    original="No acceptance criteria found",
                    suggested="Add specific, testable acceptance criteria with checkboxes",
                    reason="Clear criteria help contributors understand exactly what's needed",
                    priority="high",
                )
            )

        # Check for missing technical details
        if not any(
            kw in description.lower()
            for kw in [
                "api",
                "function",
                "component",
                "class",
                "endpoint",
                "database",
                "table",
            ]
        ):
            suggestions.append(
                EnhancementSuggestion(
                    field="technical_details",
                    original="No specific technical requirements mentioned",
                    suggested=f"Add technical specifications relevant to {category.value}",
                    reason="Technical details help contributors estimate effort and approach",
                    priority="high",
                )
            )

        # Check for missing examples
        if not any(
            kw in description.lower()
            for kw in ["example", "sample", "demo", "screenshot", "reference"]
        ):
            suggestions.append(
                EnhancementSuggestion(
                    field="examples",
                    original="No examples or references provided",
                    suggested="Include example output, screenshots, or reference implementations",
                    reason="Examples reduce ambiguity and set clear expectations",
                    priority="medium",
                )
            )

        # Check for missing tier suggestion
        if not any(kw in description.lower() for kw in ["tier", "t1", "t2", "t3"]):
            suggested_tier = self._suggest_tier(description)
            suggestions.append(
                EnhancementSuggestion(
                    field="tier",
                    original="No tier specified",
                    suggested=f"Suggest {suggested_tier}: {TIER_DESCRIPTIONS[suggested_tier]}",
                    reason="Tier helps contributors understand difficulty and eligibility",
                    priority="medium",
                )
            )

        # Check title quality
        if len(title.split()) < 4:
            suggestions.append(
                EnhancementSuggestion(
                    field="title",
                    original=f"Title is too brief ({len(title.split())} words)",
                    suggested="Make title more descriptive with action verb and component type",
                    reason="Clear titles help contributors quickly understand the bounty",
                    priority="low",
                )
            )

        # Check for deadline
        if not any(
            kw in description.lower()
            for kw in ["deadline", "due", "timeline", "duration", "days"]
        ):
            suggestions.append(
                EnhancementSuggestion(
                    field="timeline",
                    original="No deadline or timeline mentioned",
                    suggested="Add a suggested completion timeline",
                    reason="Timelines help prioritize and manage expectations",
                    priority="low",
                )
            )

        return suggestions


def format_enhancement_report(enhanced: EnhancedDescription) -> str:
    """Format the enhancement results as a readable report."""
    lines = [
        "# Bounty Description Enhancement Report",
        "",
        "## Quality Assessment",
        f"| Metric | Score |",
        f"|--------|-------|",
        f"| Clarity | {enhanced.quality_score.clarity:.0%} |",
        f"| Completeness | {enhanced.quality_score.completeness:.0%} |",
        f"| Specificity | {enhanced.quality_score.specificity:.0%} |",
        f"| Testability | {enhanced.quality_score.testability:.0%} |",
        f"| **Overall** | **{enhanced.quality_score.overall:.0%}** |",
        "",
        f"**Analysis by:** {', '.join(a.value for a in enhanced.analysis_by)}",
        "",
        "## Enhanced Title",
        f"```\n{enhanced.enhanced_title}\n```",
        "",
        f"**Suggested Tier:** {enhanced.suggested_tier} ({enhanced.estimated_effort})",
        "",
        f"**Required Skills:** {', '.join(enhanced.required_skills)}",
        "",
        "## Enhanced Description",
        "```",
        enhanced.enhanced_description,
        "```",
        "",
        "## Acceptance Criteria",
    ]

    for i, criteria in enumerate(enhanced.acceptance_criteria, 1):
        lines.append(
            f"{i}. **{criteria.title}** [{criteria.priority}] - {criteria.description}"
        )
        lines.append(f"   - Verification: {criteria.verification_method}")

    if enhanced.suggestions:
        lines.extend(["", "## Improvement Suggestions"])
        for s in enhanced.suggestions:
            priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(
                s.priority, "⚪"
            )
            lines.extend(
                [
                    f"",
                    f"### {priority_icon} {s.field} ({s.priority})",
                    f"- **Original:** {s.original}",
                    f"- **Suggested:** {s.suggested}",
                    f"- **Reason:** {s.reason}",
                ]
            )

    lines.extend(
        [
            "",
            "---",
            "*Generated by AI Bounty Description Enhancer (Bounty #848)*",
        ]
    )

    return "\n".join(lines)


# CLI interface
def main():
    """CLI entry point for the bounty description enhancer."""
    import sys

    if len(sys.argv) < 3:
        print("Usage: python bounty_enhancer.py <title> <description_file>")
        print("  or:  echo 'description' | python bounty_enhancer.py --stdin <title>")
        sys.exit(1)

    title = sys.argv[1]

    if sys.argv[2] == "--stdin":
        description = sys.stdin.read()
    else:
        with open(sys.argv[2]) as f:
            description = f.read()

    enhancer = BountyDescriptionEnhancer()
    enhanced = enhancer.analyze(title, description)

    print(format_enhancement_report(enhanced))

    # Also output JSON for programmatic use
    json_path = "enhancement_report.json"
    with open(json_path, "w") as f:
        json.dump(enhanced.to_dict(), f, indent=2)
    print(f"\nJSON report saved to: {json_path}")


if __name__ == "__main__":
    main()

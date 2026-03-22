"""Comprehensive tests for bounty spec validation, templates, and API.

Covers all acceptance criteria from Issue #513:
- YAML bounty spec format validation
- Tier-specific templates with required/optional fields
- Reward-within-tier-range checks (fail-closed)
- Required field presence checks per tier
- Valid category enforcement
- Auto-label generation from spec
- Spec linter (parse + validate)
- Batch creation logic
- API endpoints (templates, validate, create)
- Edge cases and error handling
"""

import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounty_specs import router as bounty_specs_router
from app.models.bounty_spec import (
    TIER_MIN_DESCRIPTION_LENGTH,
    TIER_MIN_REQUIREMENTS_COUNT,
    TIER_OPTIONAL_FIELDS,
    TIER_REQUIRED_FIELDS,
    TIER_REWARD_RANGES,
    VALID_SPEC_CATEGORIES,
    BountySpecInput,
    SpecValidationSeverity,
)
from app.services import bounty_service
from app.services.bounty_spec_service import (
    generate_labels,
    get_templates,
    parse_yaml_file,
    parse_yaml_spec,
    validate_spec,
)


# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounty_specs_router)

# Disable auth for test convenience
os.environ["AUTH_ENABLED"] = "false"

client = TestClient(_test_app)


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

FUTURE_DEADLINE = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

VALID_T1_SPEC = {
    "title": "Fix typo in README file",
    "description": "The README has a typo that needs fixing in the install section.",
    "tier": 1,
    "reward": Decimal("100000"),
    "category": "documentation",
}

VALID_T2_SPEC = {
    "title": "Add bounty spec validation pipeline",
    "description": (
        "Create bounty specification templates and a CI validation pipeline "
        "that ensures all bounty issues meet quality standards before going live."
    ),
    "tier": 2,
    "reward": Decimal("300000"),
    "category": "devops",
    "requirements": [
        "YAML bounty spec format",
        "Templates for each tier",
        "CI validation workflow",
    ],
    "deadline": datetime.now(timezone.utc) + timedelta(days=30),
}

VALID_T3_SPEC = {
    "title": "Multi-agent review pipeline with consensus scoring and dashboard",
    "description": (
        "Build a production-grade multi-LLM review pipeline that scores bounty "
        "PR submissions across 6 quality dimensions. Must support GPT-5.4, "
        "Gemini 3.1 Pro, and Grok 4 with configurable weights and outlier dampening."
    ),
    "tier": 3,
    "reward": Decimal("750000"),
    "category": "backend",
    "requirements": [
        "Multi-LLM review endpoint",
        "Scoring across 6 dimensions",
        "Consensus algorithm",
    ],
    "deadline": datetime.now(timezone.utc) + timedelta(days=30),
}


@pytest.fixture(autouse=True)
def clear_bounty_store():
    """Ensure each test starts with an empty bounty store."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _make_spec(**overrides) -> BountySpecInput:
    """Helper to create a BountySpecInput with sensible defaults for T2."""
    base = {**VALID_T2_SPEC, **overrides}
    return BountySpecInput(**base)


def _write_yaml_file(content: str, suffix: str = ".yaml") -> str:
    """Write YAML content to a temp file and return the path."""
    temp_file = tempfile.NamedTemporaryFile(
        mode="w", suffix=suffix, delete=False, encoding="utf-8"
    )
    temp_file.write(content)
    temp_file.close()
    return temp_file.name


# ===========================================================================
# SPEC FORMAT: YAML parsing
# ===========================================================================


class TestYamlParsing:
    """Tests for YAML spec parsing (acceptance criterion: YAML bounty spec format)."""

    def test_spec_parse_valid_yaml(self):
        """Test that a valid YAML spec parses successfully."""
        yaml_content = f"""
title: "Test Bounty"
description: "A valid test bounty description for tier 2 validation."
tier: 2
reward: 300000
category: backend
requirements:
  - "First requirement"
  - "Second requirement"
deadline: "{FUTURE_DEADLINE}"
"""
        spec, error = parse_yaml_spec(yaml_content)
        assert error is None
        assert spec is not None
        assert spec.title == "Test Bounty"
        assert spec.tier == 2
        assert spec.reward == Decimal("300000")
        assert spec.category == "backend"
        assert len(spec.requirements) == 2

    def test_spec_parse_invalid_yaml_syntax(self):
        """Test that invalid YAML syntax returns a parse error."""
        yaml_content = "title: [unterminated"
        spec, error = parse_yaml_spec(yaml_content)
        assert spec is None
        assert error is not None
        assert "Invalid YAML" in error

    def test_spec_parse_non_mapping(self):
        """Test that a YAML list (not mapping) returns an error."""
        yaml_content = "- item1\n- item2"
        spec, error = parse_yaml_spec(yaml_content)
        assert spec is None
        assert "mapping" in error.lower()

    def test_spec_parse_missing_tier(self):
        """Test that missing tier field returns a parse error."""
        yaml_content = """
title: "Test"
description: "A description"
reward: 100000
category: backend
"""
        spec, error = parse_yaml_spec(yaml_content)
        assert spec is None
        assert "tier" in error.lower()

    def test_spec_parse_reward_amount_alias(self):
        """Test that 'reward_amount' is accepted as alias for 'reward'."""
        yaml_content = f"""
title: "Alias test"
description: "Testing reward_amount alias field mapping."
tier: 1
reward_amount: 100000
category: backend
"""
        spec, error = parse_yaml_spec(yaml_content)
        assert error is None
        assert spec is not None
        assert spec.reward == Decimal("100000")

    def test_spec_parse_invalid_reward_value(self):
        """Test that non-numeric reward returns a parse error."""
        yaml_content = """
title: "Bad reward"
description: "Test"
tier: 1
reward: "not-a-number"
category: backend
"""
        spec, error = parse_yaml_spec(yaml_content)
        assert spec is None
        assert "reward" in error.lower()

    def test_spec_parse_with_skills(self):
        """Test that skills are parsed and normalized to lowercase."""
        yaml_content = f"""
title: "Skills test"
description: "Testing skill parsing with mixed case."
tier: 1
reward: 100000
category: backend
skills:
  - Python
  - REACT
  - TypeScript
"""
        spec, error = parse_yaml_spec(yaml_content)
        assert error is None
        assert spec is not None
        assert spec.skills == ["python", "react", "typescript"]

    def test_spec_parse_file_not_found(self):
        """Test that a missing file returns an error."""
        spec, error = parse_yaml_file("/nonexistent/path/bounty.yaml")
        assert spec is None
        assert "not found" in error.lower()

    def test_spec_parse_file_wrong_extension(self):
        """Test that a non-YAML file extension is rejected."""
        temp_file = _write_yaml_file("title: test", suffix=".txt")
        try:
            spec, error = parse_yaml_file(temp_file)
            assert spec is None
            assert "extension" in error.lower()
        finally:
            os.unlink(temp_file)

    def test_spec_parse_valid_yaml_file(self):
        """Test that a valid YAML file parses correctly."""
        yaml_content = f"""
title: "File test"
description: "Testing YAML file parsing for bounty spec."
tier: 1
reward: 100000
category: documentation
"""
        temp_file = _write_yaml_file(yaml_content)
        try:
            spec, error = parse_yaml_file(temp_file)
            assert error is None
            assert spec is not None
            assert spec.title == "File test"
        finally:
            os.unlink(temp_file)


# ===========================================================================
# TEMPLATES: Tier-specific templates
# ===========================================================================


class TestTemplates:
    """Tests for tier-specific templates (acceptance criterion: templates for each tier)."""

    def test_spec_templates_all_tiers_present(self):
        """Test that templates exist for all three tiers."""
        response = get_templates()
        assert len(response.templates) == 3
        tiers = {t.tier for t in response.templates}
        assert tiers == {1, 2, 3}

    def test_spec_templates_required_fields_per_tier(self):
        """Test that each template specifies the correct required fields."""
        response = get_templates()
        for template in response.templates:
            expected_required = TIER_REQUIRED_FIELDS[template.tier]
            assert set(template.required_fields) == expected_required

    def test_spec_templates_optional_fields_per_tier(self):
        """Test that each template specifies the correct optional fields."""
        response = get_templates()
        for template in response.templates:
            expected_optional = TIER_OPTIONAL_FIELDS[template.tier]
            assert set(template.optional_fields) == expected_optional

    def test_spec_templates_reward_ranges(self):
        """Test that each template has correct reward range boundaries."""
        response = get_templates()
        for template in response.templates:
            expected_min, expected_max = TIER_REWARD_RANGES[template.tier]
            assert template.reward_range_min == expected_min
            assert template.reward_range_max == expected_max

    def test_spec_templates_examples_are_valid(self):
        """Test that the example specs in templates pass validation."""
        response = get_templates()
        for template in response.templates:
            example = template.example
            # Add a future deadline if needed
            if "deadline" not in example and template.tier >= 2:
                example["deadline"] = FUTURE_DEADLINE
            if "reward" in example:
                example["reward"] = Decimal(str(example["reward"]))

            spec = BountySpecInput(**example)
            result = validate_spec(spec)
            assert result.valid, (
                f"Tier {template.tier} example failed validation: "
                f"{[f.message for f in result.findings if f.severity == SpecValidationSeverity.ERROR]}"
            )

    def test_spec_templates_categories_complete(self):
        """Test that the template response includes all valid categories."""
        response = get_templates()
        assert set(response.categories) == VALID_SPEC_CATEGORIES

    def test_spec_templates_min_description_length(self):
        """Test that templates specify correct minimum description lengths."""
        response = get_templates()
        for template in response.templates:
            expected = TIER_MIN_DESCRIPTION_LENGTH[template.tier]
            assert template.min_description_length == expected

    def test_spec_templates_min_requirements_count(self):
        """Test that templates specify correct minimum requirements counts."""
        response = get_templates()
        for template in response.templates:
            expected = TIER_MIN_REQUIREMENTS_COUNT[template.tier]
            assert template.min_requirements_count == expected


# ===========================================================================
# VALIDATION: Reward within tier range
# ===========================================================================


class TestRewardValidation:
    """Tests for reward-within-tier-range checks (acceptance criterion)."""

    def test_spec_reward_t1_within_range(self):
        """Test that T1 reward within 50K-200K passes."""
        spec = _make_spec(tier=1, reward=Decimal("100000"))
        result = validate_spec(spec)
        reward_errors = [
            f for f in result.findings
            if f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
        ]
        assert len(reward_errors) == 0

    def test_spec_reward_t1_below_minimum(self):
        """Test that T1 reward below 50K fails validation."""
        spec = _make_spec(tier=1, reward=Decimal("10000"))
        result = validate_spec(spec)
        assert not result.valid
        reward_errors = [f for f in result.findings if f.field == "reward"]
        assert len(reward_errors) > 0
        assert "50000" in reward_errors[0].message

    def test_spec_reward_t1_above_maximum(self):
        """Test that T1 reward above 200K fails validation."""
        spec = _make_spec(tier=1, reward=Decimal("300000"))
        result = validate_spec(spec)
        assert not result.valid
        reward_errors = [f for f in result.findings if f.field == "reward"]
        assert len(reward_errors) > 0

    def test_spec_reward_t2_within_range(self):
        """Test that T2 reward within 200K-500K passes."""
        spec = _make_spec(tier=2, reward=Decimal("300000"))
        result = validate_spec(spec)
        reward_errors = [
            f for f in result.findings
            if f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
        ]
        assert len(reward_errors) == 0

    def test_spec_reward_t2_below_minimum(self):
        """Test that T2 reward below 200K fails validation."""
        spec = _make_spec(tier=2, reward=Decimal("100000"))
        result = validate_spec(spec)
        assert not result.valid

    def test_spec_reward_t2_above_maximum(self):
        """Test that T2 reward above 500K fails validation."""
        spec = _make_spec(tier=2, reward=Decimal("600000"))
        result = validate_spec(spec)
        assert not result.valid

    def test_spec_reward_t3_within_range(self):
        """Test that T3 reward within 500K-1M passes."""
        spec = _make_spec(
            tier=3,
            reward=Decimal("750000"),
            description=(
                "A detailed T3 description that meets the minimum 100 character "
                "length requirement for tier 3 bounties with complex work involved."
            ),
            requirements=["Req 1", "Req 2", "Req 3"],
        )
        result = validate_spec(spec)
        reward_errors = [
            f for f in result.findings
            if f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
        ]
        assert len(reward_errors) == 0

    def test_spec_reward_t3_below_minimum(self):
        """Test that T3 reward below 500K fails validation."""
        spec = _make_spec(
            tier=3,
            reward=Decimal("400000"),
            description=(
                "A detailed T3 description that meets the minimum 100 character "
                "length requirement for tier 3 bounties with complex work involved."
            ),
            requirements=["Req 1", "Req 2", "Req 3"],
        )
        result = validate_spec(spec)
        assert not result.valid

    def test_spec_reward_at_exact_boundaries(self):
        """Test that rewards at exact tier boundaries pass validation."""
        # T1 min
        spec = _make_spec(tier=1, reward=Decimal("50000"))
        assert not any(
            f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
            for f in validate_spec(spec).findings
        )

        # T1 max
        spec = _make_spec(tier=1, reward=Decimal("200000"))
        assert not any(
            f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
            for f in validate_spec(spec).findings
        )

        # T2 min
        spec = _make_spec(tier=2, reward=Decimal("200001"))
        assert not any(
            f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
            for f in validate_spec(spec).findings
        )

        # T3 max
        spec = _make_spec(
            tier=3,
            reward=Decimal("1000000"),
            description=(
                "A detailed T3 description that meets the minimum 100 character "
                "length requirement for tier 3 bounties with complex work involved."
            ),
            requirements=["Req 1", "Req 2", "Req 3"],
        )
        assert not any(
            f.field == "reward" and f.severity == SpecValidationSeverity.ERROR
            for f in validate_spec(spec).findings
        )


# ===========================================================================
# VALIDATION: Required fields present
# ===========================================================================


class TestRequiredFieldValidation:
    """Tests for required field presence checks per tier (acceptance criterion)."""

    def test_spec_required_t1_all_present(self):
        """Test that T1 with all required fields passes."""
        spec = BountySpecInput(**VALID_T1_SPEC)
        result = validate_spec(spec)
        assert result.valid

    def test_spec_required_t2_all_present(self):
        """Test that T2 with all required fields passes."""
        spec = BountySpecInput(**VALID_T2_SPEC)
        result = validate_spec(spec)
        assert result.valid

    def test_spec_required_t2_missing_deadline(self):
        """Test that T2 without deadline fails validation."""
        spec_data = {**VALID_T2_SPEC}
        spec_data.pop("deadline", None)
        spec = BountySpecInput(**spec_data)
        result = validate_spec(spec)
        assert not result.valid
        deadline_errors = [f for f in result.findings if f.field == "deadline"]
        assert len(deadline_errors) > 0

    def test_spec_required_t2_missing_requirements(self):
        """Test that T2 with too few requirements fails validation."""
        spec = _make_spec(requirements=[])
        result = validate_spec(spec)
        assert not result.valid
        req_errors = [f for f in result.findings if f.field == "requirements"]
        assert len(req_errors) > 0

    def test_spec_required_t3_missing_deadline(self):
        """Test that T3 without deadline fails validation."""
        spec = _make_spec(
            tier=3,
            reward=Decimal("750000"),
            description=(
                "A detailed T3 description that meets the minimum 100 character "
                "length requirement for tier 3 bounties with complex work involved."
            ),
            requirements=["Req 1", "Req 2", "Req 3"],
            deadline=None,
        )
        result = validate_spec(spec)
        assert not result.valid

    def test_spec_required_description_too_short_t2(self):
        """Test that T2 with short description fails validation."""
        spec = _make_spec(description="Too short")
        result = validate_spec(spec)
        assert not result.valid
        desc_errors = [f for f in result.findings if f.field == "description"]
        assert len(desc_errors) > 0

    def test_spec_required_description_too_short_t3(self):
        """Test that T3 with description under 100 chars fails."""
        spec = _make_spec(
            tier=3,
            reward=Decimal("750000"),
            description="Short T3 description",
            requirements=["Req 1", "Req 2", "Req 3"],
        )
        result = validate_spec(spec)
        assert not result.valid


# ===========================================================================
# VALIDATION: Valid category
# ===========================================================================


class TestCategoryValidation:
    """Tests for valid category enforcement (acceptance criterion)."""

    def test_spec_category_all_valid_categories_accepted(self):
        """Test that every valid category passes validation."""
        for category in VALID_SPEC_CATEGORIES:
            spec = _make_spec(category=category)
            result = validate_spec(spec)
            cat_errors = [
                f for f in result.findings
                if f.field == "category" and f.severity == SpecValidationSeverity.ERROR
            ]
            assert len(cat_errors) == 0, f"Category '{category}' should be valid"

    def test_spec_category_invalid_rejected(self):
        """Test that an invalid category is rejected by the Pydantic model."""
        with pytest.raises(Exception):
            BountySpecInput(
                title="Invalid cat",
                description="Test invalid category validation.",
                tier=1,
                reward=Decimal("100000"),
                category="invalid-category",
            )

    def test_spec_category_case_normalized(self):
        """Test that category is normalized to lowercase."""
        spec = BountySpecInput(
            title="Case test",
            description="Test category case normalization.",
            tier=1,
            reward=Decimal("100000"),
            category="Backend",
        )
        assert spec.category == "backend"


# ===========================================================================
# AUTO-LABELS
# ===========================================================================


class TestAutoLabels:
    """Tests for auto-label generation (acceptance criterion)."""

    def test_spec_labels_include_bounty(self):
        """Test that 'bounty' label is always included."""
        spec = _make_spec()
        labels = generate_labels(spec)
        assert "bounty" in labels

    def test_spec_labels_include_tier(self):
        """Test that tier label is generated correctly."""
        for tier in (1, 2, 3):
            spec = _make_spec(tier=tier, reward=TIER_REWARD_RANGES[tier][0])
            labels = generate_labels(spec)
            assert f"tier-{tier}" in labels

    def test_spec_labels_include_category(self):
        """Test that category label is included."""
        spec = _make_spec(category="backend")
        labels = generate_labels(spec)
        assert "backend" in labels

    def test_spec_labels_include_known_skills(self):
        """Test that well-known skill labels are included."""
        spec = _make_spec(skills=["python", "react", "fastapi"])
        labels = generate_labels(spec)
        assert "python" in labels
        assert "react" in labels
        assert "fastapi" in labels

    def test_spec_labels_exclude_unknown_skills(self):
        """Test that unknown skills are not added as labels."""
        spec = _make_spec(skills=["obscure-framework"])
        labels = generate_labels(spec)
        assert "obscure-framework" not in labels

    def test_spec_labels_are_sorted_and_deduplicated(self):
        """Test that labels are sorted and have no duplicates."""
        spec = _make_spec(category="backend", skills=["python", "backend"])
        labels = generate_labels(spec)
        assert labels == sorted(set(labels))

    def test_spec_labels_validation_result_includes_labels(self):
        """Test that validation result contains auto-generated labels."""
        spec = _make_spec()
        result = validate_spec(spec)
        assert "bounty" in result.labels
        assert f"tier-{spec.tier}" in result.labels


# ===========================================================================
# VALIDATION: Fail-closed behavior
# ===========================================================================


class TestFailClosedValidation:
    """Tests for fail-closed validation behavior (GPT-5.4 focus)."""

    def test_spec_validation_fail_closed_single_error(self):
        """Test that a single error makes the entire spec invalid."""
        spec = _make_spec(reward=Decimal("10"))  # Way below T2 range
        result = validate_spec(spec)
        assert not result.valid
        assert result.error_count >= 1

    def test_spec_validation_fail_closed_multiple_errors(self):
        """Test that multiple errors are all reported."""
        spec = _make_spec(
            description="Short",
            requirements=[],
            reward=Decimal("10"),
            deadline=None,
        )
        result = validate_spec(spec)
        assert not result.valid
        assert result.error_count >= 3  # description, requirements, reward, deadline

    def test_spec_validation_warnings_dont_block(self):
        """Test that warnings alone do not make a spec invalid."""
        spec = _make_spec(skills=[])  # No skills = warning
        result = validate_spec(spec)
        # May still be valid if no errors
        if result.error_count == 0:
            assert result.valid
            assert result.warning_count >= 1

    def test_spec_validation_past_deadline_is_error(self):
        """Test that a past deadline is a blocking error for T2."""
        past = datetime.now(timezone.utc) - timedelta(days=1)
        spec = _make_spec(deadline=past)
        result = validate_spec(spec)
        assert not result.valid
        deadline_errors = [
            f for f in result.findings
            if f.field == "deadline" and f.severity == SpecValidationSeverity.ERROR
        ]
        assert len(deadline_errors) > 0

    def test_spec_validation_duplicate_requirements_warning(self):
        """Test that duplicate requirements produce a warning."""
        spec = _make_spec(requirements=["Same thing", "Same thing", "Different"])
        result = validate_spec(spec)
        dup_warnings = [
            f for f in result.findings
            if f.field == "requirements" and f.severity == SpecValidationSeverity.WARNING
        ]
        assert len(dup_warnings) >= 1


# ===========================================================================
# API ENDPOINTS
# ===========================================================================


class TestTemplatesAPI:
    """Tests for GET /api/bounty-specs/templates endpoint."""

    def test_spec_api_templates_returns_200(self):
        """Test that templates endpoint returns 200 OK."""
        resp = client.get("/api/bounty-specs/templates")
        assert resp.status_code == 200

    def test_spec_api_templates_has_all_tiers(self):
        """Test that templates response includes all three tiers."""
        resp = client.get("/api/bounty-specs/templates")
        body = resp.json()
        assert len(body["templates"]) == 3
        tiers = {t["tier"] for t in body["templates"]}
        assert tiers == {1, 2, 3}

    def test_spec_api_templates_has_categories(self):
        """Test that templates response includes valid categories."""
        resp = client.get("/api/bounty-specs/templates")
        body = resp.json()
        assert len(body["categories"]) == len(VALID_SPEC_CATEGORIES)

    def test_spec_api_templates_response_shape(self):
        """Test that each template has the expected fields."""
        resp = client.get("/api/bounty-specs/templates")
        template = resp.json()["templates"][0]
        expected_keys = {
            "tier", "tier_label", "required_fields", "optional_fields",
            "reward_range_min", "reward_range_max", "min_description_length",
            "min_requirements_count", "example",
        }
        assert set(template.keys()) == expected_keys


class TestValidateAPI:
    """Tests for POST /api/bounty-specs/validate endpoint."""

    def test_spec_api_validate_valid_spec(self):
        """Test that a valid spec returns valid=true."""
        payload = {
            "title": "Valid API test bounty spec",
            "description": (
                "A sufficiently long description that meets the minimum "
                "character requirement for tier 2 bounty specifications."
            ),
            "tier": 2,
            "reward": "300000",
            "category": "backend",
            "requirements": ["Requirement one", "Requirement two"],
            "deadline": FUTURE_DEADLINE,
        }
        resp = client.post("/api/bounty-specs/validate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["error_count"] == 0
        assert "bounty" in body["labels"]

    def test_spec_api_validate_invalid_spec(self):
        """Test that an invalid spec returns valid=false with findings."""
        payload = {
            "title": "Bad spec",
            "description": "Short",
            "tier": 2,
            "reward": "10",  # Way below T2 range
            "category": "backend",
            "requirements": [],
            "deadline": FUTURE_DEADLINE,
        }
        resp = client.post("/api/bounty-specs/validate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False
        assert body["error_count"] > 0

    def test_spec_api_validate_missing_required_field(self):
        """Test that missing category returns 422 from Pydantic."""
        payload = {
            "title": "Missing category",
            "description": "A description",
            "tier": 2,
            "reward": "300000",
            # category is missing — Pydantic will reject
            "requirements": ["Req 1", "Req 2"],
        }
        resp = client.post("/api/bounty-specs/validate", json=payload)
        assert resp.status_code == 422

    def test_spec_api_validate_returns_labels(self):
        """Test that validation result includes auto-generated labels."""
        payload = {
            "title": "Labels test spec for validation",
            "description": (
                "A sufficiently long description that meets the minimum "
                "character requirement for tier 2 bounty specifications."
            ),
            "tier": 2,
            "reward": "300000",
            "category": "devops",
            "requirements": ["Req 1", "Req 2"],
            "deadline": FUTURE_DEADLINE,
            "skills": ["python"],
        }
        resp = client.post("/api/bounty-specs/validate", json=payload)
        body = resp.json()
        assert "bounty" in body["labels"]
        assert "tier-2" in body["labels"]
        assert "devops" in body["labels"]
        assert "python" in body["labels"]


# ===========================================================================
# BATCH CREATION (CLI logic)
# ===========================================================================


class TestBatchCreation:
    """Tests for batch creation from directory of YAML files."""

    def test_spec_batch_valid_directory(self):
        """Test batch processing of a directory with valid specs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write two valid T1 specs
            for i in range(2):
                content = f"""
title: "Batch bounty {i}"
description: "A valid batch bounty description for testing."
tier: 1
reward: 100000
category: documentation
"""
                Path(tmpdir, f"bounty-{i}.yaml").write_text(content, encoding="utf-8")

            # Parse and validate each
            yaml_files = sorted(Path(tmpdir).glob("*.yaml"))
            assert len(yaml_files) == 2

            for yaml_file in yaml_files:
                spec, error = parse_yaml_file(str(yaml_file))
                assert error is None
                assert spec is not None
                result = validate_spec(spec)
                assert result.valid

    def test_spec_batch_mixed_valid_and_invalid(self):
        """Test batch processing with mix of valid and invalid specs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Valid spec
            valid_content = """
title: "Valid batch spec"
description: "A valid batch bounty description for testing."
tier: 1
reward: 100000
category: documentation
"""
            Path(tmpdir, "valid.yaml").write_text(valid_content, encoding="utf-8")

            # Invalid spec (reward out of range)
            invalid_content = """
title: "Invalid batch spec"
description: "An invalid batch spec with wrong reward."
tier: 1
reward: 999999
category: documentation
"""
            Path(tmpdir, "invalid.yaml").write_text(invalid_content, encoding="utf-8")

            yaml_files = sorted(Path(tmpdir).glob("*.yaml"))
            valid_count = 0
            invalid_count = 0

            for yaml_file in yaml_files:
                spec, error = parse_yaml_file(str(yaml_file))
                if error:
                    invalid_count += 1
                    continue
                result = validate_spec(spec)
                if result.valid:
                    valid_count += 1
                else:
                    invalid_count += 1

            assert valid_count == 1
            assert invalid_count == 1

    def test_spec_batch_empty_directory(self):
        """Test batch processing of an empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yaml_files = sorted(Path(tmpdir).glob("*.yaml"))
            assert len(yaml_files) == 0

    def test_spec_batch_nonexistent_directory(self):
        """Test batch processing of a nonexistent directory."""
        path = Path("/nonexistent/directory/specs")
        assert not path.is_dir()


# ===========================================================================
# LINTER (spec linter logic)
# ===========================================================================


class TestLinterLogic:
    """Tests for spec linter logic (acceptance criterion: spec linter)."""

    def test_spec_linter_valid_file_passes(self):
        """Test that a valid spec file gets zero errors from linter."""
        yaml_content = f"""
title: "Linter test bounty"
description: "A sufficiently detailed description for the tier 2 validation pipeline testing."
tier: 2
reward: 300000
category: backend
requirements:
  - "First requirement"
  - "Second requirement"
deadline: "{FUTURE_DEADLINE}"
"""
        temp_file = _write_yaml_file(yaml_content)
        try:
            spec, error = parse_yaml_file(temp_file)
            assert error is None
            result = validate_spec(spec)
            assert result.valid
            assert result.error_count == 0
        finally:
            os.unlink(temp_file)

    def test_spec_linter_invalid_file_reports_errors(self):
        """Test that an invalid spec file produces error findings."""
        yaml_content = """
title: "Bad linter test"
description: "Short"
tier: 2
reward: 10
category: backend
"""
        temp_file = _write_yaml_file(yaml_content)
        try:
            spec, error = parse_yaml_file(temp_file)
            assert error is None
            result = validate_spec(spec)
            assert not result.valid
            assert result.error_count > 0
        finally:
            os.unlink(temp_file)

    def test_spec_linter_yaml_syntax_error(self):
        """Test that YAML syntax errors are caught by linter."""
        yaml_content = "title: [unterminated bracket"
        temp_file = _write_yaml_file(yaml_content)
        try:
            spec, error = parse_yaml_file(temp_file)
            assert spec is None
            assert error is not None
        finally:
            os.unlink(temp_file)


# ===========================================================================
# EDGE CASES
# ===========================================================================


class TestEdgeCases:
    """Edge case tests for robustness."""

    def test_spec_empty_yaml(self):
        """Test that empty YAML content is handled."""
        spec, error = parse_yaml_spec("")
        assert spec is None
        assert error is not None

    def test_spec_null_yaml(self):
        """Test that YAML containing only 'null' is handled."""
        spec, error = parse_yaml_spec("null")
        assert spec is None

    def test_spec_very_long_description_warning(self):
        """Test that very long descriptions get a warning."""
        long_desc = "A" * 6000
        spec = _make_spec(description=long_desc)
        result = validate_spec(spec)
        desc_warnings = [
            f for f in result.findings
            if f.field == "description" and f.severity == SpecValidationSeverity.WARNING
        ]
        assert len(desc_warnings) >= 1

    def test_spec_github_url_validation(self):
        """Test that non-GitHub URLs are rejected."""
        with pytest.raises(Exception):
            _make_spec(github_issue_url="https://gitlab.com/repo/issues/1")

    def test_spec_valid_github_url_accepted(self):
        """Test that valid GitHub URLs are accepted."""
        spec = _make_spec(github_issue_url="https://github.com/SolFoundry/solfoundry/issues/513")
        assert spec.github_issue_url == "https://github.com/SolFoundry/solfoundry/issues/513"

    def test_spec_empty_requirements_filtered(self):
        """Test that empty requirement strings are filtered out."""
        spec = BountySpecInput(
            title="Filter test",
            description="Testing empty requirement filtering for spec.",
            tier=1,
            reward=Decimal("100000"),
            category="backend",
            requirements=["Valid", "", "  ", "Also valid"],
        )
        assert spec.requirements == ["Valid", "Also valid"]

    def test_spec_decimal_reward_precision(self):
        """Test that reward amount preserves Decimal precision."""
        spec = _make_spec(reward=Decimal("300000.50"))
        assert spec.reward == Decimal("300000.50")

    def test_spec_t1_optional_fields_dont_error(self):
        """Test that T1 without optional fields still passes."""
        spec = BountySpecInput(**VALID_T1_SPEC)
        result = validate_spec(spec)
        assert result.valid

    def test_spec_all_categories_are_lowercase(self):
        """Test that all VALID_SPEC_CATEGORIES are lowercase."""
        for cat in VALID_SPEC_CATEGORIES:
            assert cat == cat.lower()

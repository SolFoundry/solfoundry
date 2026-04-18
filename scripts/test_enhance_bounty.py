#!/usr/bin/env python3
"""Tests for the AI Bounty Description Enhancer."""

import json
import sys
import os
import importlib.util
from pathlib import Path

# Add scripts directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

# Import from hyphenated filename using importlib
spec = importlib.util.spec_from_file_location("enhance_bounty", SCRIPT_DIR / "enhance-bounty.py")
enhance_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enhance_mod)

IssueFinding = enhance_mod.IssueFinding
Severity = enhance_mod.Severity
EnhancedSection = enhance_mod.EnhancedSection
EnhancementResult = enhance_mod.EnhancementResult
parse_llm_response = enhance_mod.parse_llm_response
merge_results = enhance_mod.merge_results
format_terminal = enhance_mod.format_terminal
format_diff = enhance_mod.format_diff
_build_enhancement_prompt = enhance_mod._build_enhancement_prompt


def test_parse_llm_response():
    """Test JSON extraction from LLM responses with various formats."""
    # Plain JSON
    raw = '{"findings": [], "enhanced_title": "Test", "confidence": 0.9}'
    result = parse_llm_response(raw)
    assert result["enhanced_title"] == "Test"
    assert result["confidence"] == 0.9

    # JSON in code fence
    raw = '```json\n{"enhanced_title": "Fenced"}\n```'
    result = parse_llm_response(raw)
    assert result["enhanced_title"] == "Fenced"

    # JSON with surrounding text
    raw = 'Here is the result:\n```json\n{"enhanced_title": "With text"}\n```\nDone.'
    result = parse_llm_response(raw)
    assert result["enhanced_title"] == "With text"

    print("  [PASS] test_parse_llm_response")


def test_merge_results():
    """Test merging results from multiple providers."""
    r1 = {
        "findings": [
            {"severity": "error", "category": "missing_criteria", "message": "No criteria"},
            {"severity": "warning", "category": "vague_language", "message": "Too vague"},
        ],
        "enhanced_title": "Title A",
        "enhanced_description": "Short desc",
        "confidence": 0.8,
    }
    r2 = {
        "findings": [
            {"severity": "error", "category": "missing_criteria", "message": "No criteria"},
            {"severity": "info", "category": "no_examples", "message": "Add examples"},
        ],
        "enhanced_title": "Title B",
        "enhanced_description": "This is a much longer and more detailed description of the bounty",
        "confidence": 0.9,
    }

    merged = merge_results([r1, r2])
    # Should take the longer description
    assert len(merged["enhanced_description"]) > len("Short desc")
    # Should deduplicate findings (3 unique)
    assert len(merged["findings"]) == 3
    # Should have a confidence score
    assert 0 <= merged["confidence"] <= 1

    print("  [PASS] test_merge_results")


def test_merge_single_result():
    """Test merging with only one result (passthrough)."""
    r = {"findings": [], "enhanced_title": "Solo", "confidence": 1.0}
    merged = merge_results([r])
    assert merged["enhanced_title"] == "Solo"

    print("  [PASS] test_merge_single_result")


def test_enhancement_result_serialization():
    """Test EnhancementResult to_dict serialization."""
    result = EnhancementResult(
        original_title="Original",
        original_description="Desc",
        enhanced_title="Enhanced",
        enhanced_description="Better desc",
        findings=[
            IssueFinding(severity=Severity.ERROR, category="test", message="Test finding")
        ],
        sections={
            "overview": EnhancedSection(original="O", enhanced="E", changes=["Changed O to E"])
        },
        confidence_score=0.85,
        providers_used=["test-provider"],
    )

    d = result.to_dict()
    assert d["enhanced_title"] == "Enhanced"
    assert d["findings"][0]["severity"] == "error"
    assert d["confidence_score"] == 0.85
    assert d["providers_used"] == ["test-provider"]
    assert "overview" in d["sections"]

    print("  [PASS] test_enhancement_result_serialization")


def test_format_terminal():
    """Test terminal output formatting."""
    result = EnhancementResult(
        original_title="Test",
        original_description="Old",
        enhanced_title="Improved Test",
        enhanced_description="New and improved description",
        findings=[
            IssueFinding(severity=Severity.ERROR, category="missing_criteria", message="No criteria listed"),
            IssueFinding(severity=Severity.WARNING, category="vague_language", message="Too vague"),
        ],
        confidence_score=0.75,
        providers_used=["provider-a", "provider-b"],
    )

    output = format_terminal(result)
    assert "AI BOUNTY DESCRIPTION ENHANCER" in output
    assert "Improved Test" in output
    assert "75%" in output
    assert "provider-a" in output
    assert "missing_criteria" in output

    print("  [PASS] test_format_terminal")


def test_format_diff():
    """Test diff output formatting."""
    result = EnhancementResult(
        original_title="Old Title",
        original_description="Line 1\nLine 2\nLine 3",
        enhanced_title="New Title",
        enhanced_description="Line 1\nImproved Line 2\nLine 3\nNew Line 4",
    )

    diff = format_diff(result)
    assert "Old Title" in diff
    assert "New Title" in diff
    assert "+ Improved Line 2" in diff
    assert "+ New Line 4" in diff

    print("  [PASS] test_format_diff")


def test_build_prompt():
    """Test prompt construction."""
    prompt = _build_enhancement_prompt("My Title", "My description here")
    assert "My Title" in prompt
    assert "My description here" in prompt
    assert "acceptance criteria" in prompt.lower()

    print("  [PASS] test_build_prompt")


def test_empty_merge():
    """Test merging empty results."""
    merged = merge_results([])
    assert merged == {}

    print("  [PASS] test_empty_merge")


def run_all_tests():
    """Run all tests."""
    print("Running AI Bounty Description Enhancer tests...\n")

    tests = [
        test_parse_llm_response,
        test_merge_results,
        test_merge_single_result,
        test_enhancement_result_serialization,
        test_format_terminal,
        test_format_diff,
        test_build_prompt,
        test_empty_merge,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {test.__name__}: {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())

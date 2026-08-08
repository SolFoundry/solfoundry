"""Tests for the AI Code Review GitHub App."""

import json
import pytest
from datetime import datetime, timezone

from ..models import DiffFile, Finding, Severity, ReviewResult
from ..config import ReviewConfig, ReviewMode, StrictnessLevel, CommentStyle
from ..analyzers import SecurityAnalyzer, PerformanceAnalyzer, BestPracticesAnalyzer


class TestModels:
    def test_finding_to_line_comment(self):
        f = Finding(severity=Severity.CRITICAL, category="test", message="Bad thing",
                    file="test.py", line=10, suggestion="Fix it")
        comment = f.to_line_comment()
        assert comment["path"] == "test.py"
        assert comment["line"] == 10
        assert "CRITICAL" in comment["body"]

    def test_review_result_counts(self):
        r = ReviewResult(score=7.0, findings=[
            Finding(severity=Severity.CRITICAL, category="", message="a"),
            Finding(severity=Severity.HIGH, category="", message="b"),
            Finding(severity=Severity.MEDIUM, category="", message="c"),
            Finding(severity=Severity.LOW, category="", message="d"),
        ])
        assert r.critical_count == 1
        assert r.high_count == 1
        assert r.medium_count == 1
        assert r.low_count == 1


class TestConfig:
    def test_default_config(self):
        c = ReviewConfig()
        assert c.mode == ReviewMode.STANDARD
        assert c.strictness == StrictnessLevel.BALANCED
        assert c.comment_style == CommentStyle.INLINE

    def test_score_threshold(self):
        lenient = ReviewConfig(strictness=StrictnessLevel.LENIENT)
        balanced = ReviewConfig(strictness=StrictnessLevel.BALANCED)
        strict = ReviewConfig(strictness=StrictnessLevel.STRICT)
        assert lenient.get_score_threshold() == 6.0
        assert balanced.get_score_threshold() == 7.0
        assert strict.get_score_threshold() == 8.0


class TestSecurityAnalyzer:
    def test_hardcoded_secret(self):
        analyzer = SecurityAnalyzer()
        files = [DiffFile(filename="config.py", patch='+API_KEY = "sk-abc123def456ghi789"\n-no issue')]
        findings = analyzer.analyze(files)
        assert len(findings) >= 1
        assert findings[0].severity == Severity.CRITICAL

    def test_no_false_positive(self):
        analyzer = SecurityAnalyzer()
        files = [DiffFile(filename="config.py", patch='+API_KEY = os.getenv("API_KEY")')]
        findings = analyzer.analyze(files)
        assert len(findings) == 0


class TestPerformanceAnalyzer:
    def test_n_plus_one(self):
        analyzer = PerformanceAnalyzer()
        files = [DiffFile(filename="repo.py", patch='''async def get_users():
    users = await db.query(User).all()
    for user in users:
        profile = await db.query(Profile).filter(Profile.user_id == user.id).one()
''')]
        findings = analyzer.analyze(files)
        assert len(findings) >= 1
        assert "N+1" in findings[0].category

    def test_sync_in_async(self):
        analyzer = PerformanceAnalyzer()
        files = [DiffFile(filename="handler.py", patch='''async def handle_request():
    resp = requests.get("https://api.example.com")
    return resp.json()
''')]
        findings = analyzer.analyze(files)
        assert len(findings) >= 1


class TestBestPracticesAnalyzer:
    def test_console_log(self):
        analyzer = BestPracticesAnalyzer()
        files = [DiffFile(filename="app.ts", patch='+console.log("debug info")')]
        findings = analyzer.analyze(files)
        assert len(findings) >= 1

    def test_bare_except(self):
        analyzer = BestPracticesAnalyzer()
        files = [DiffFile(filename="main.py", patch='+except:\n+    pass')]
        findings = analyzer.analyze(files)
        assert len(findings) >= 1


class TestDiffFile:
    def test_extension(self):
        assert DiffFile(filename="main.py", patch="").extension == "py"
        assert DiffFile(filename="component.tsx", patch="").extension == "tsx"
        assert DiffFile(filename="NoExt", patch="").extension == ""


class TestReviewResult:
    def test_aggregation(self):
        findings = [
            Finding(severity=Severity.CRITICAL, category="sec", message="secret"),
            Finding(severity=Severity.HIGH, category="sec", message="eval"),
            Finding(severity=Severity.LOW, category="perf", message="loop"),
        ]
        r = ReviewResult(score=7.5, findings=findings)
        assert r.score == 7.5
        assert r.critical_count == 1
        assert r.high_count == 1
        assert len(r.findings) == 3
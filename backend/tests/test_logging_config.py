"""Tests for structured logging configuration."""

import json
import logging
import os
import tempfile

import pytest

from app.core.correlation import set_correlation_id


class TestJSONFormatter:
    def test_format_produces_valid_json(self):
        from app.core.logging_config import JSONFormatter

        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=42,
            msg="hello %s",
            args=("world",),
            exc_info=None,
        )
        record.correlation_id = "test-cid-001"  # type: ignore[attr-defined]

        output = formatter.format(record)
        data = json.loads(output)

        assert data["level"] == "INFO"
        assert data["message"] == "hello world"
        assert data["correlation_id"] == "test-cid-001"
        assert data["logger"] == "test.logger"
        assert data["line"] == 42
        assert "timestamp" in data

    def test_format_includes_exception_info(self):
        from app.core.logging_config import JSONFormatter

        formatter = JSONFormatter()
        try:
            raise ValueError("boom")
        except ValueError:
            import sys
            record = logging.LogRecord(
                name="test",
                level=logging.ERROR,
                pathname="test.py",
                lineno=1,
                msg="caught",
                args=(),
                exc_info=sys.exc_info(),
            )
            record.correlation_id = "-"  # type: ignore[attr-defined]

        output = formatter.format(record)
        data = json.loads(output)

        assert "exception" in data
        assert data["exception"]["type"] == "ValueError"
        assert data["exception"]["message"] == "boom"
        assert "traceback" in data["exception"]

    def test_format_includes_extra_fields(self):
        from app.core.logging_config import JSONFormatter

        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="access",
            args=(),
            exc_info=None,
        )
        record.correlation_id = "-"  # type: ignore[attr-defined]
        record.method = "GET"  # type: ignore[attr-defined]
        record.path = "/api/test"  # type: ignore[attr-defined]
        record.status_code = 200  # type: ignore[attr-defined]
        record.duration_ms = 12.5  # type: ignore[attr-defined]

        output = formatter.format(record)
        data = json.loads(output)

        assert data["method"] == "GET"
        assert data["path"] == "/api/test"
        assert data["status_code"] == 200
        assert data["duration_ms"] == 12.5


class TestTextFormatter:
    def test_format_includes_correlation_id(self):
        from app.core.logging_config import TextFormatter

        formatter = TextFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="hi",
            args=(),
            exc_info=None,
        )
        record.correlation_id = "text-cid-123"  # type: ignore[attr-defined]
        output = formatter.format(record)
        assert "text-cid-123" in output
        assert "INFO" in output


class TestCorrelationFilter:
    def test_filter_injects_correlation_id(self):
        from app.core.logging_config import CorrelationFilter

        filt = CorrelationFilter()
        set_correlation_id("filter-cid")
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="msg", args=(), exc_info=None,
        )
        filt.filter(record)
        assert record.correlation_id == "filter-cid"  # type: ignore[attr-defined]

    def test_filter_uses_dash_when_no_correlation_id(self):
        from app.core.logging_config import CorrelationFilter
        from app.core.correlation import _correlation_id

        _correlation_id.set(None)
        filt = CorrelationFilter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="msg", args=(), exc_info=None,
        )
        filt.filter(record)
        assert record.correlation_id == "-"  # type: ignore[attr-defined]


class TestSetupLogging:
    def test_setup_creates_log_directory(self):
        import importlib
        import app.core.logging_config as lc

        with tempfile.TemporaryDirectory() as tmpdir:
            log_dir = os.path.join(tmpdir, "test_logs")
            orig_log_dir = lc.LOG_DIR
            lc.LOG_DIR = log_dir
            try:
                lc.setup_logging()
                assert os.path.isdir(log_dir)
            finally:
                lc.LOG_DIR = orig_log_dir

    def test_log_levels_available(self):
        for level_name in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
            assert hasattr(logging, level_name)
            assert isinstance(getattr(logging, level_name), int)

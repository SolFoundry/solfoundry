"""Structured logging configuration with JSON formatting, multiple streams, and rotation.

Log streams:
  - application: General app logs (DEBUG+)
  - access: HTTP request/response logs (INFO+)
  - error: Errors and exceptions (ERROR+)
  - audit: Sensitive operation trails (INFO+)

All output is structured JSON for machine parsing. Correlation IDs are
injected automatically via a logging filter that reads from contextvars.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
import json
from datetime import datetime, timezone
from typing import Optional

from app.core.correlation import get_correlation_id


LOG_DIR = os.getenv("LOG_DIR", "logs")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", "json")  # "json" or "text"

MAX_BYTES = int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024)))  # 10 MB
BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", "5"))
RETENTION_DAYS = int(os.getenv("LOG_RETENTION_DAYS", "30"))


class CorrelationFilter(logging.Filter):
    """Inject the current correlation ID into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"  # type: ignore[attr-defined]
        return True


class JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "-"),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        for attr in ("method", "path", "status_code", "duration_ms", "client_ip",
                      "user_id", "action", "resource_type", "resource_id", "details"):
            val = getattr(record, attr, None)
            if val is not None:
                log_entry[attr] = val

        return json.dumps(log_entry, default=str)


class TextFormatter(logging.Formatter):
    """Human-readable formatter for local development."""

    FMT = "%(asctime)s [%(levelname)-8s] [%(correlation_id)s] %(name)s: %(message)s"

    def __init__(self) -> None:
        super().__init__(fmt=self.FMT, datefmt="%Y-%m-%d %H:%M:%S")


def _make_handler(
    filepath: Optional[str],
    level: int,
    formatter: logging.Formatter,
) -> logging.Handler:
    """Create a rotating file handler, or a stream handler when filepath is None."""
    if filepath:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        handler = logging.handlers.RotatingFileHandler(
            filepath,
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8",
        )
    else:
        handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(formatter)
    handler.addFilter(CorrelationFilter())
    return handler


def setup_logging() -> None:
    """Initialise all loggers and handlers. Call once at application startup."""
    formatter: logging.Formatter
    if LOG_FORMAT == "json":
        formatter = JSONFormatter()
    else:
        formatter = TextFormatter()

    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    root.handlers.clear()

    console = _make_handler(None, root.level, formatter)
    root.addHandler(console)

    file_streams = {
        "application": logging.DEBUG,
        "access": logging.INFO,
        "error": logging.ERROR,
        "audit": logging.INFO,
    }

    for stream_name, level in file_streams.items():
        filepath = os.path.join(LOG_DIR, f"{stream_name}.log")
        file_handler = _make_handler(filepath, level, formatter)
        stream_logger = logging.getLogger(f"solfoundry.{stream_name}")
        stream_logger.setLevel(level)
        stream_logger.addHandler(file_handler)
        stream_logger.addFilter(CorrelationFilter())
        stream_logger.propagate = True

    access_logger = logging.getLogger("solfoundry.access")
    access_logger.propagate = False
    access_handler = _make_handler(
        os.path.join(LOG_DIR, "access.log"), logging.INFO, formatter
    )
    access_logger.addHandler(access_handler)
    stdout_access = _make_handler(None, logging.INFO, formatter)
    access_logger.addHandler(stdout_access)

    audit_logger = logging.getLogger("solfoundry.audit")
    audit_logger.propagate = False
    audit_handler = _make_handler(
        os.path.join(LOG_DIR, "audit.log"), logging.INFO, formatter
    )
    audit_logger.addHandler(audit_handler)
    stdout_audit = _make_handler(None, logging.INFO, formatter)
    audit_logger.addHandler(stdout_audit)

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()

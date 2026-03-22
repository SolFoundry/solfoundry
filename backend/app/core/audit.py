"""Audit logging for security-sensitive operations.

Provides both a decorator (log_audit) for wrapping functions and a
direct function (audit_event) for ad-hoc audit entries. All events
are written to a structured audit log stream via structlog.
"""

import asyncio
import functools
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger("audit")

# Try to use structlog if available; fall back to stdlib logging
try:
    import structlog
    _logger = structlog.get_logger("audit")
except ImportError:
    _logger = None  # type: ignore[assignment]


def log_audit(
    event: str, get_details: Optional[Callable[..., dict]] = None
) -> Callable:
    """Decorator to log sensitive operations to the audit stream.

    Logs both success and failure outcomes. When a details extractor
    is provided, its return value is merged into the log context.

    Args:
        event: The audit event name (e.g. 'bounty_created').
        get_details: Optional callable that extracts context from the
            decorated function's arguments.

    Returns:
        A decorator that wraps the target function with audit logging.
    """

    def decorator(func: Callable) -> Callable:
        """Apply audit logging to the wrapped function."""

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Async wrapper that logs before and after execution."""
            details = get_details(*args, **kwargs) if get_details else {}
            try:
                result = await func(*args, **kwargs)
                audit_event(event, status="success", **details)
                return result
            except Exception as exc:
                audit_event(event, status="failure", error=str(exc), **details)
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Sync wrapper that logs before and after execution."""
            details = get_details(*args, **kwargs) if get_details else {}
            try:
                result = func(*args, **kwargs)
                audit_event(event, status="success", **details)
                return result
            except Exception as exc:
                audit_event(event, status="failure", error=str(exc), **details)
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def audit_event(event: str, **kwargs: Any) -> None:
    """Log a single audit event with structured context.

    Writes to the structlog audit logger if available, otherwise
    falls back to the standard library logger.

    Args:
        event: The audit event name (e.g. 'milestone_created').
        **kwargs: Additional context fields to include in the log entry.
    """
    if _logger is not None:
        _logger.info(event, **kwargs)
    else:
        logger.info("AUDIT: %s %s", event, kwargs)

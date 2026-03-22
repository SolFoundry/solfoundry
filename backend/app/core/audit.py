"""Audit logging for security-sensitive operations.

Provides both a decorator (log_audit) for wrapping functions and a
direct function (audit_event) for ad-hoc audit entries. All events
are written to a structured audit log stream via structlog.
"""

import asyncio
import functools
from typing import Any, Callable, Optional

import structlog


logger = structlog.get_logger("audit")


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
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Async audit wrapper that logs success or failure."""
            try:
                result = await func(*args, **kwargs)
                details = get_details(*args, **kwargs) if get_details else {}
                logger.info(event, status="success", **details)
                return result
            except Exception as exc:
                details = get_details(*args, **kwargs) if get_details else {}
                logger.warning(event, status="failure", error=str(exc), **details)
                raise exc

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Sync audit wrapper that logs success or failure."""
            try:
                result = func(*args, **kwargs)
                details = get_details(*args, **kwargs) if get_details else {}
                logger.info(event, status="success", **details)
                return result
            except Exception as exc:
                details = get_details(*args, **kwargs) if get_details else {}
                logger.warning(event, status="failure", error=str(exc), **details)
                raise exc

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def audit_event(event: str, **kwargs: Any) -> None:
    """Directly log an audit event with arbitrary context.

    Args:
        event: The audit event name.
        **kwargs: Additional key-value pairs to include in the log entry.
    """
    logger.info(event, **kwargs)

import functools
import structlog
from typing import Callable, Optional

logger = structlog.get_logger("audit")

def log_audit(event: str, get_details: Optional[Callable[..., dict]] = None):
    """Decorator to log sensitive operations to the audit stream."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                result = await func(*args, **kwargs)
                details = get_details(*args, **kwargs) if get_details else {}
                logger.info(
                    event,
                    status="success",
                    **details
                )
                return result
            except Exception as e:
                details = get_details(*args, **kwargs) if get_details else {}
                logger.warning(
                    event,
                    status="failure",
                    error=str(e),
                    **details
                )
                raise e

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                details = get_details(*args, **kwargs) if get_details else {}
                logger.info(
                    event,
                    status="success",
                    **details
                )
                return result
            except Exception as e:
                details = get_details(*args, **kwargs) if get_details else {}
                logger.warning(
                    event,
                    status="failure",
                    error=str(e),
                    **details
                )
                raise e

        # Handle both async and sync functions
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator

def audit_event(event: str, **kwargs):
    """Directly log an audit event."""
    logger.info(event, **kwargs)

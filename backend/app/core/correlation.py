"""Correlation ID middleware for distributed request tracing.

Each inbound HTTP request is assigned a unique correlation ID (UUID4).
If the caller supplies an ``X-Correlation-ID`` header the value is reused,
making it possible to trace requests across service boundaries.

The ID is stored in a :mod:`contextvars` variable so any logger that uses
:class:`~app.core.logging_config.CorrelationFilter` will include it
automatically.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)

access_logger = logging.getLogger("solfoundry.access")

HEADER_NAME = "X-Correlation-ID"


def get_correlation_id() -> Optional[str]:
    return _correlation_id.get()


def set_correlation_id(cid: str) -> None:
    _correlation_id.set(cid)


class CorrelationMiddleware(BaseHTTPMiddleware):
    """Assign / propagate a correlation ID and log access information."""

    async def dispatch(self, request: Request, call_next) -> Response:
        cid = request.headers.get(HEADER_NAME) or str(uuid.uuid4())
        set_correlation_id(cid)

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers[HEADER_NAME] = cid

        client_ip = request.client.host if request.client else "unknown"
        access_logger.info(
            "%s %s %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
            },
        )

        return response

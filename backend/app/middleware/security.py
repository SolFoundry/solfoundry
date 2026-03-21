"""Security headers and request limit middleware for FastAPI (Issue #160).

Adds industry-standard security headers (HSTS, CSP, XFO) and enforces a
configurable maximum request payload size.
"""

import logging
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Configurable limits
MAX_PAYLOAD_SIZE = 10 * 1024 * 1024  # 10MB default
CSP_DEFAULT = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"


class SecurityMiddleware(BaseHTTPMiddleware):
    """Enforce security headers and request size limits."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Enforce request size limit based on Content-Length header
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_PAYLOAD_SIZE:
            logger.warning(
                f"Request payload too large: {content_length} bytes from {request.client.host}"
            )
            return JSONResponse(
                status_code=413,
                content={
                    "message": "Request payload exceeds maximum allowed size (10MB).",
                    "code": "PAYLOAD_TOO_LARGE",
                },
            )

        # Proceed to next middleware/handler
        response = await call_next(request)

        # Set Security Headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = CSP_DEFAULT
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        return response

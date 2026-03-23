"""HTTP security headers middleware for production hardening.

Implements comprehensive security headers following OWASP recommendations:
- Strict-Transport-Security (HSTS) with preload
- Content-Security-Policy (CSP) restricting resource origins
- X-Frame-Options preventing clickjacking
- X-Content-Type-Options preventing MIME sniffing
- Referrer-Policy limiting referrer information leakage
- Permissions-Policy restricting browser feature access
- Cache-Control headers for sensitive endpoints
- Request body size enforcement to prevent resource exhaustion
"""

import logging
import os
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Maximum request body size in bytes (default 1 MB)
MAX_REQUEST_BODY_SIZE: int = int(
    os.getenv("MAX_REQUEST_BODY_SIZE", str(1 * 1024 * 1024))
)

# Whether to enforce HTTPS (disable in local dev)
ENFORCE_HTTPS: bool = os.getenv("ENFORCE_HTTPS", "true").lower() == "true"

# HSTS max-age in seconds (default: 1 year)
HSTS_MAX_AGE: int = int(os.getenv("HSTS_MAX_AGE", "31536000"))

# CSP directives
CSP_DEFAULT_SRC: str = os.getenv("CSP_DEFAULT_SRC", "'self'")
CSP_SCRIPT_SRC: str = os.getenv(
    "CSP_SCRIPT_SRC", "'self' 'unsafe-inline' 'unsafe-eval'"
)
CSP_STYLE_SRC: str = os.getenv(
    "CSP_STYLE_SRC", "'self' 'unsafe-inline' https://fonts.googleapis.com"
)
CSP_IMG_SRC: str = os.getenv(
    "CSP_IMG_SRC", "'self' data: https: https://solfoundry.org"
)
CSP_CONNECT_SRC: str = os.getenv(
    "CSP_CONNECT_SRC", "'self' https://api.mainnet-beta.solana.com"
)
CSP_FONT_SRC: str = os.getenv("CSP_FONT_SRC", "'self' https://fonts.gstatic.com")
CSP_FRAME_ANCESTORS: str = os.getenv("CSP_FRAME_ANCESTORS", "'none'")

# Paths considered sensitive (no caching)
SENSITIVE_PATH_PREFIXES: tuple[str, ...] = (
    "/auth/",
    "/api/payouts",
    "/api/treasury",
)


def _build_csp_header() -> str:
    directives = [
        f"default-src {CSP_DEFAULT_SRC}",
        f"script-src {CSP_SCRIPT_SRC}",
        f"style-src {CSP_STYLE_SRC}",
        f"img-src {CSP_IMG_SRC}",
        f"connect-src {CSP_CONNECT_SRC}",
        f"font-src {CSP_FONT_SRC}",
        f"frame-ancestors {CSP_FRAME_ANCESTORS}",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
    ]
    return "; ".join(directives)


def _build_permissions_policy() -> str:
    policies = [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "magnetometer=()",
        "gyroscope=()",
        "accelerometer=()",
    ]
    return ", ".join(policies)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """OWASP-recommended security headers and request body size enforcement."""

    def __init__(self, app: Callable) -> None:
        super().__init__(app)
        self.csp_header = _build_csp_header()
        self.permissions_policy = _build_permissions_policy()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Enforce request body size limit
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": "Request body too large",
                    "code": "PAYLOAD_TOO_LARGE",
                },
            )

        response = await call_next(request)

        # Apply Headers
        if ENFORCE_HTTPS:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={HSTS_MAX_AGE}; includeSubDomains; preload"
            )

        response.headers["Content-Security-Policy"] = self.csp_header
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = self.permissions_policy

        if any(request.url.path.startswith(p) for p in SENSITIVE_PATH_PREFIXES):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        if "Server" in response.headers:
            del response.headers["Server"]

        return response


# Alias for backward compatibility with existing tests
SecurityMiddleware = SecurityHeadersMiddleware

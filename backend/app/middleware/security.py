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

References:
    - OWASP Secure Headers: https://owasp.org/www-project-secure-headers/
    - MDN Security Headers: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
"""

import logging
import os
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Maximum request body size in bytes (default 1 MB)
MAX_REQUEST_BODY_SIZE: int = int(os.getenv("MAX_REQUEST_BODY_SIZE", str(1 * 1024 * 1024)))

# Whether to enforce HTTPS (disable in local dev)
ENFORCE_HTTPS: bool = os.getenv("ENFORCE_HTTPS", "true").lower() == "true"

# HSTS max-age in seconds (default: 1 year)
HSTS_MAX_AGE: int = int(os.getenv("HSTS_MAX_AGE", "31536000"))

# CSP directives (configurable via environment for CDN adjustments)
CSP_DEFAULT_SRC: str = os.getenv("CSP_DEFAULT_SRC", "'self'")
CSP_SCRIPT_SRC: str = os.getenv("CSP_SCRIPT_SRC", "'self'")
CSP_STYLE_SRC: str = os.getenv("CSP_STYLE_SRC", "'self' 'unsafe-inline'")
CSP_IMG_SRC: str = os.getenv("CSP_IMG_SRC", "'self' data: https:")
CSP_CONNECT_SRC: str = os.getenv("CSP_CONNECT_SRC", "'self' https://api.mainnet-beta.solana.com")
CSP_FONT_SRC: str = os.getenv("CSP_FONT_SRC", "'self'")
CSP_FRAME_ANCESTORS: str = os.getenv("CSP_FRAME_ANCESTORS", "'none'")

# Paths considered sensitive (no caching)
SENSITIVE_PATH_PREFIXES: tuple[str, ...] = (
    "/auth/",
    "/api/payouts",
    "/api/treasury",
)


def _build_csp_header() -> str:
    """Build the Content-Security-Policy header value from configured directives.

    Returns:
        str: The fully assembled CSP header string with all configured directives.
    """
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
    """Build the Permissions-Policy header restricting browser feature access.

    Disables camera, microphone, geolocation, payment, and other sensitive
    browser APIs that a development platform does not need.

    Returns:
        str: The Permissions-Policy header value.
    """
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
    """Middleware that injects security headers into every HTTP response.

    This middleware adds OWASP-recommended security headers to protect against:
    - Clickjacking (X-Frame-Options, CSP frame-ancestors)
    - XSS (Content-Security-Policy, X-Content-Type-Options)
    - Protocol downgrade attacks (Strict-Transport-Security)
    - Information leakage (Referrer-Policy, Permissions-Policy)
    - Resource exhaustion (request body size limit)

    Configuration is via environment variables to allow per-environment tuning
    without code changes.

    Attributes:
        csp_header: Pre-built Content-Security-Policy header value.
        permissions_policy: Pre-built Permissions-Policy header value.
    """

    def __init__(self, app: Callable) -> None:
        """Initialize the security headers middleware.

        Args:
            app: The ASGI application to wrap.
        """
        super().__init__(app)
        self.csp_header = _build_csp_header()
        self.permissions_policy = _build_permissions_policy()
        logger.info(
            "SecurityHeadersMiddleware initialized (HTTPS enforcement: %s, "
            "max body size: %d bytes, HSTS max-age: %d seconds)",
            ENFORCE_HTTPS,
            MAX_REQUEST_BODY_SIZE,
            HSTS_MAX_AGE,
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and inject security headers into the response.

        Enforces request body size limits before forwarding to the application.
        Adds all configured security headers to the response on the way out.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware or route handler in the chain.

        Returns:
            Response: The HTTP response with security headers added.
        """
        # Enforce request body size limit
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
            logger.warning(
                "Request body too large: %s bytes from %s %s",
                content_length,
                request.method,
                request.url.path,
            )
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )

        response = await call_next(request)

        # HSTS - enforce HTTPS with preload support
        if ENFORCE_HTTPS:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={HSTS_MAX_AGE}; includeSubDomains; preload"
            )

        # Content-Security-Policy
        response.headers["Content-Security-Policy"] = self.csp_header

        # Clickjacking protection
        response.headers["X-Frame-Options"] = "DENY"

        # MIME sniffing protection
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer policy - send origin only for cross-origin requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy - restrict browser features
        response.headers["Permissions-Policy"] = self.permissions_policy

        # Prevent caching of sensitive endpoints
        if any(request.url.path.startswith(p) for p in SENSITIVE_PATH_PREFIXES):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        # Remove server identification header if present
        if "Server" in response.headers:
            del response.headers["Server"]

        return response

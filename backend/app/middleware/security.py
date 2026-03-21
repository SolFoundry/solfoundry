"""Security headers and request limit middleware for FastAPI.

Adds industry-standard security headers and enforces configurable limits.
Updated for Issue #197 - Production Security Hardening.

Features:
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Request size limits
- Request method filtering
"""

import os
import logging
from typing import Callable, Set

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Environment
ENV = os.getenv("ENV", "development").lower()

# Configurable limits
MAX_PAYLOAD_SIZE = int(os.getenv("MAX_PAYLOAD_SIZE", 10 * 1024 * 1024))  # 10MB default

# Allowed request methods
ALLOWED_METHODS: Set[str] = {"GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS", "HEAD"}

# CSP Configuration
# In development, allow more for local development tools
# In production, be more restrictive
if ENV == "development":
    CSP_DEFAULT = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https: blob:; "
        "connect-src 'self' ws://localhost:* wss://* https://*.solfoundry.org https://api.github.com; "
        "frame-ancestors 'none';"
    )
else:
    CSP_DEFAULT = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' wss://*.solfoundry.org https://api.github.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

# Permissions Policy - disable unnecessary browser features
PERMISSIONS_POLICY = (
    "accelerometer=(), "
    "ambient-light-sensor=(), "
    "autoplay=(), "
    "battery=(), "
    "camera=(), "
    "display-capture=(), "
    "document-domain=(), "
    "encrypted-media=(), "
    "execution-while-not-rendered=(), "
    "execution-while-out-of-viewport=(), "
    "fullscreen=(), "
    "geolocation=(), "
    "gyroscope=(), "
    "magnetometer=(), "
    "microphone=(), "
    "midi=(), "
    "navigation-override=(), "
    "payment=(), "
    "picture-in-picture=(), "
    "publickey-credentials-get=(), "
    "screen-wake-lock=(), "
    "sync-xhr=(), "
    "usb=(), "
    "web-share=(), "
    "xr-spatial-tracking=()"
)


class SecurityMiddleware(BaseHTTPMiddleware):
    """Enforce security headers and request limits."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check request method
        if request.method not in ALLOWED_METHODS:
            logger.warning(
                f"Blocked request with disallowed method: {request.method} from {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=405,
                content={
                    "message": f"Method {request.method} not allowed",
                    "code": "METHOD_NOT_ALLOWED",
                },
            )
        
        # Enforce request size limit based on Content-Length header
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_PAYLOAD_SIZE:
            logger.warning(
                f"Request payload too large: {content_length} bytes from {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=413,
                content={
                    "message": f"Request payload exceeds maximum allowed size ({MAX_PAYLOAD_SIZE // (1024*1024)}MB).",
                    "code": "PAYLOAD_TOO_LARGE",
                },
            )
        
        # Block common attack patterns in URL
        if self._is_malicious_path(request.url.path):
            logger.warning(
                f"Blocked malicious path request: {request.url.path} from {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=400,
                content={
                    "message": "Invalid request",
                    "code": "BAD_REQUEST",
                },
            )
        
        # Proceed to next middleware/handler
        response = await call_next(request)
        
        # Set Security Headers
        self._set_security_headers(response)
        
        return response
    
    def _is_malicious_path(self, path: str) -> bool:
        """Check for common malicious path patterns."""
        malicious_patterns = [
            "../",           # Path traversal
            "..\\",          # Windows path traversal
            "%2e%2e",        # URL encoded path traversal
            "%252e",         # Double URL encoded
            "\x00",          # Null byte injection
            "javascript:",   # JavaScript protocol
            "data:",         # Data URI (potential XSS)
            "vbscript:",     # VBScript (IE)
        ]
        
        path_lower = path.lower()
        for pattern in malicious_patterns:
            if pattern.lower() in path_lower:
                return True
        
        return False
    
    def _set_security_headers(self, response: Response) -> None:
        """Set all security headers on response."""
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS protection (legacy, but still useful for older browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # HSTS - only in production
        if ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = CSP_DEFAULT
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = PERMISSIONS_POLICY
        
        # Prevent Flash/PDF cross-domain access
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        
        # Disable caching for API responses
        if ENV == "production":
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"


def get_csp_nonce() -> str:
    """Generate a nonce for inline scripts/styles (if needed).
    
    Usage:
        nonce = get_csp_nonce()
        # Add to CSP: script-src 'self' 'nonce-{nonce}'
        # Use in template: <script nonce="{{ nonce }}">...</script>
    """
    import secrets
    return secrets.token_urlsafe(16)


def get_csp_report_uri() -> str:
    """Get CSP violation report URI."""
    return os.getenv("CSP_REPORT_URI", "/api/csp-report")
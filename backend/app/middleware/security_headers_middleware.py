"""Middleware to inject security headers into responses."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # HSTS: HTTP Strict Transport Security
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        # CSP: Content Security Policy - restrict to self and necessary domains
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
        # X-Frame-Options: prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # X-Content-Type-Options: prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Referrer-Policy
        response.headers["Referrer-Policy"] = "same-origin"
        # Permissions-Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response

"""Security middleware package for SolFoundry backend.

This package provides production-grade security middleware including:
- HTTP security headers (HSTS, CSP, X-Frame-Options, etc.)
- Input sanitization (XSS, SQL injection, HTML escaping)
- Rate limiting with tiered access levels
- Request size limiting
- Sensitive data logging filter

All middleware is registered via ``register_security_middleware`` in main.py.
"""

from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.sanitization import InputSanitizationMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware

__all__ = [
    "SecurityHeadersMiddleware",
    "InputSanitizationMiddleware",
    "RateLimitMiddleware",
]

"""HTTPS enforcement middleware for production deployments.

Redirects HTTP requests to HTTPS and sets HSTS headers.
"""

import os
import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

logger = logging.getLogger(__name__)

# Environment check
ENV = os.getenv("ENV", "development").lower()
FORCE_HTTPS = os.getenv("FORCE_HTTPS", "true").lower() == "true"
# HSTS settings
HSTS_MAX_AGE = 31536000  # 1 year
HSTS_INCLUDE_SUBDOMAINS = True
HSTS_PRELOAD = False  # Be careful with preload - difficult to remove


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Enforce HTTPS in production environments.
    
    Features:
    - Redirects HTTP to HTTPS
    - Sets Strict-Transport-Security header
    - Handles X-Forwarded-Proto for reverse proxy setups
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check and enforce HTTPS."""
        
        # Skip in development unless explicitly forced
        if ENV == "development" and not FORCE_HTTPS:
            return await call_next(request)
        
        # Check if request is already HTTPS
        if self._is_https(request):
            response = await call_next(request)
            # Add HSTS header
            response.headers["Strict-Transport-Security"] = self._build_hsts_header()
            return response
        
        # Redirect HTTP to HTTPS
        https_url = self._build_https_url(request)
        logger.info(f"Redirecting HTTP to HTTPS: {request.url} -> {https_url}")
        
        return RedirectResponse(
            url=https_url,
            status_code=308,  # Permanent redirect, preserves method
        )
    
    def _is_https(self, request: Request) -> bool:
        """Check if request is using HTTPS.
        
        Handles various proxy configurations:
        - Direct TLS connection
        - X-Forwarded-Proto header (from load balancer)
        - X-Forwarded-Ssl header (AWS ELB)
        """
        # Check direct TLS connection
        if request.url.scheme == "https":
            return True
        
        # Check X-Forwarded-Proto (standard)
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "").lower()
        if forwarded_proto == "https":
            return True
        
        # Check X-Forwarded-Ssl (AWS ELB)
        forwarded_ssl = request.headers.get("X-Forwarded-Ssl", "").lower()
        if forwarded_ssl == "on":
            return True
        
        # Check Front-End-Https (Microsoft)
        front_end_https = request.headers.get("Front-End-Https", "").lower()
        if front_end_https == "on":
            return True
        
        return False
    
    def _build_https_url(self, request: Request) -> str:
        """Build HTTPS URL for redirect."""
        url = request.url
        
        # Get host from headers or URL
        host = request.headers.get("Host", url.hostname)
        if url.port and url.port not in (80, 443):
            host = f"{host}:{url.port}"
        
        # Build HTTPS URL
        https_url = f"https://{host}{url.path}"
        
        # Preserve query string
        if url.query:
            https_url = f"{https_url}?{url.query}"
        
        return https_url
    
    def _build_hsts_header(self) -> str:
        """Build Strict-Transport-Security header value."""
        parts = [f"max-age={HSTS_MAX_AGE}"]
        
        if HSTS_INCLUDE_SUBDOMAINS:
            parts.append("includeSubDomains")
        
        if HSTS_PRELOAD:
            parts.append("preload")
        
        return "; ".join(parts)


def get_secure_cookie_settings() -> dict:
    """Get secure cookie settings based on environment.
    
    Returns:
        Dictionary of cookie settings for set_cookie()
    """
    is_production = ENV == "production"
    
    return {
        "secure": is_production,  # Only send over HTTPS
        "httponly": True,  # Prevent JavaScript access
        "samesite": "lax",  # CSRF protection
    }


def is_secure_request(request: Request) -> bool:
    """Check if request is secure (HTTPS).
    
    Utility function for use in route handlers.
    """
    return request.url.scheme == "https" or \
           request.headers.get("X-Forwarded-Proto", "").lower() == "https"
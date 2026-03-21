from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add production security headers to all responses.
    Implements HSTS, CSP, X-Frame-Options, and more.
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # 1. HTTP Strict Transport Security (HSTS)
        # Tells the browser to always use HTTPS for the next 1 year.
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # 2. X-Frame-Options
        # Prevents clickjacking by disallowing the site to be embedded in iframes.
        response.headers["X-Frame-Options"] = "DENY"
        
        # 3. X-Content-Type-Options
        # Prevents the browser from MIME-sniffing the response.
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # 4. Content-Security-Policy (CSP)
        # Restricts where resources can be loaded from.
        # This is a basic production-grade policy.
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https://solfoundry.org; "
            "connect-src 'self' https://api.mainnet-beta.solana.com;"
        )
        response.headers["Content-Security-Policy"] = csp_policy
        
        # 5. Referrer-Policy
        # Controls how much referrer information the browser includes with requests.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # 6. Permissions-Policy
        # Restricts use of browser features (camera, microphone, etc.)
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        return response

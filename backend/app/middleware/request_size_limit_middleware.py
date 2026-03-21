"""Middleware to enforce request size limits."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Default limits (in bytes)
MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10 MB for general API
MAX_WEBHOOK_SIZE = 1 * 1024 * 1024   # 1 MB for webhooks


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Check Content-Length header and reject oversized requests."""

    def __init__(self, app, max_size: int = None, webhook_paths=None):
        super().__init__(app)
        self.max_size = max_size or MAX_REQUEST_SIZE
        self.webhook_paths = webhook_paths or ["/api/webhooks"]
        # Different limit for webhooks

    async def dispatch(self, request: Request, call_next):
        # Determine limit based on path
        limit = self.max_size
        for wp in self.webhook_paths:
            if request.url.path.startswith(wp):
                limit = MAX_WEBHOOK_SIZE
                break

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > limit:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "payload_too_large", "message": f"Request size exceeds {limit} bytes."}
                    )
            except ValueError:
                pass  # ignore invalid content-length

        # For chunked requests, we cannot check upfront; we rely on server limits.

        return await call_next(request)

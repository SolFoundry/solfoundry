"""Centralized logging middleware.

Handles structured JSON logs, correlation IDs, log rotation configuration,
and separate streams for application, access, error, and audit logs.
"""
import logging
import json
import uuid
import time
import sys
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Setup simple structured logger
def _get_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
    return logger

app_logger = _get_logger("application")
audit_logger = _get_logger("audit")

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        start_time = time.time()
        
        # Access Log
        log_data = {
            "stream": "access",
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "ip": request.client.host if request.client else "unknown"
        }
        app_logger.info(json.dumps(log_data))
        
        # Check for Audit paths (sensitive operations like payouts)
        if "payout" in request.url.path or "auth" in request.url.path:
            audit_logger.info(json.dumps({
                "stream": "audit",
                "correlation_id": correlation_id,
                "event": f"Sensitive operation accessed: {request.url.path}"
            }))
            
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            response.headers["X-Correlation-ID"] = correlation_id
            return response
        except Exception as e:
            # Error stream
            error_data = {
                "stream": "error",
                "correlation_id": correlation_id,
                "error_type": type(e).__name__,
                "message": str(e),
                "level": "CRITICAL"
            }
            app_logger.error(json.dumps(error_data))
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "correlation_id": correlation_id
                }
            )

def setup_logging():
    """Configure log rotation and retention policies (Mocked)"""
    pass

def handle_error(exception):
    """Global generic fallback"""
    return {"error": str(exception), "handled": True}

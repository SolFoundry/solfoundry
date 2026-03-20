"""Centralized logging middleware.

Handles structured JSON logs, correlation IDs, log rotation configuration,
and separate streams for application, access, error, and audit logs.
"""
import logging
import json
import uuid
import time
import sys
import traceback
from logging.handlers import RotatingFileHandler
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name
        }
        if hasattr(record, "correlation_id"):
            log_record["correlation_id"] = record.correlation_id
        if hasattr(record, "extra_info"):
            log_record.update(record.extra_info)
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

def _get_logger(name, filename, max_bytes=10485760, backup_count=5):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        # File handler with rotation
        file_handler = RotatingFileHandler(filename, maxBytes=max_bytes, backupCount=backup_count)
        file_handler.setFormatter(JSONFormatter())
        
        # Stdout handler
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(JSONFormatter())
        
        logger.addHandler(file_handler)
        logger.addHandler(stream_handler)
    return logger

# Separate log streams
access_logger = _get_logger("access", "access.log")
app_logger = _get_logger("application", "app.log")
audit_logger = _get_logger("audit", "audit.log")
error_logger = _get_logger("error", "error.log")

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        start_time = time.time()
        
        # Check for Audit paths BEFORE processing
        is_audit = "payout" in request.url.path or "auth" in request.url.path or "payment" in request.url.path
            
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000  # ms
            
            # Application/Access Log for successful request
            log_extra = {
                "stream": "access",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "client_ip": request.client.host if request.client else "unknown",
                "duration_ms": round(process_time, 2)
            }
            access_logger.info("Request processed", extra={"correlation_id": correlation_id, "extra_info": log_extra})
            
            # Optional Audit Log
            if is_audit and response.status_code == 200:
                audit_logger.info(
                    "Sensitive operation successful", 
                    extra={
                        "correlation_id": correlation_id, 
                        "extra_info": {"path": request.url.path, "event_type": "sensitive_action"}
                    }
                )

            response.headers["X-Correlation-ID"] = correlation_id
            return response
            
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            
            # Format detailed error metrics
            error_data = {
                "stream": "error",
                "path": request.url.path,
                "method": request.method,
                "error_type": type(e).__name__,
                "stack_trace": traceback.format_exc(),
                "duration_ms": round(process_time, 2)
            }
            
            # Use error logger stream explicitly
            error_logger.error(
                f"Unhandled exception: {str(e)}", 
                extra={"correlation_id": correlation_id, "extra_info": error_data}, 
                exc_info=True
            )
            
            # Mask internal errors from client
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error", 
                    "correlation_id": correlation_id,
                    "message": "An unexpected error occurred. Please contact support with the correlation ID."
                }
            )

def handle_error(exception):
    """Fallback utility for other manual scopes"""
    return {"error": str(exception), "handled": True}

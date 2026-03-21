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
import re
import os
from logging.handlers import TimedRotatingFileHandler
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

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

def setup_logging(log_dir="logs", backup_count=7):
    """Initialize logging configuration with time-based rotation and separate streams."""
    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
        
    def configure_stream(name, filename, to_stdout=False):
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)
        logger.propagate = False
        
        # Clear existing handlers
        if logger.hasHandlers():
            logger.handlers.clear()
            
        file_handler = TimedRotatingFileHandler(
            os.path.join(log_dir, filename), 
            when="midnight",
            interval=1,
            backupCount=backup_count,
            encoding="utf-8"
        )
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)
        
        if to_stdout:
            stream_handler = logging.StreamHandler(sys.stdout)
            stream_handler.setFormatter(JSONFormatter())
            logger.addHandler(stream_handler)
        return logger

    configure_stream("access", "access.log", to_stdout=False)
    configure_stream("application", "app.log", to_stdout=True)
    configure_stream("error", "error.log", to_stdout=True)
    configure_stream("audit", "audit.log", to_stdout=False)
    
_logging_setup_done = False

def _get_logger(name):
    global _logging_setup_done
    if not _logging_setup_done:
        setup_logging()
        _logging_setup_done = True
    return logging.getLogger(name)

def _validate_correlation_id(cid: str) -> str:
    if cid and isinstance(cid, str) and len(cid) <= 50 and re.match(r'^[a-zA-Z0-9-]{10,50}$', cid):
        return cid
    return str(uuid.uuid4())

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        raw_cid = request.headers.get("X-Correlation-ID")
        correlation_id = _validate_correlation_id(raw_cid)
        request.state.correlation_id = correlation_id
        start_time = time.time()
        
        path = request.url.path
        
        # Check for Audit paths using explicit match or strictly defined prefix
        is_audit = (path in ["/api/auth/login", "/api/auth/logout"] 
                    or path.startswith("/api/payout/")
                    or path.startswith("/api/admin/bounty/status/"))
        
        try:
            response = await call_next(request)
            
            # Application/Access Log for successful request, exclude health checks from log spam
            if path not in ["/health", "/api/health"]:
                process_time = (time.time() - start_time) * 1000  # ms
                log_extra = {
                    "stream": "access",
                    "method": request.method,
                    "path": path,
                    "status_code": response.status_code,
                    "client_ip": request.client.host if request.client else "unknown",
                    "duration_ms": round(process_time, 2)
                }
                _get_logger("access").info("Request processed", extra={"correlation_id": correlation_id, "extra_info": log_extra})
                
                # Optional Audit Log
                if is_audit and response.status_code in [200, 201]:
                    _get_logger("audit").info(
                        "Sensitive operation successful", 
                        extra={
                            "correlation_id": correlation_id, 
                            "extra_info": {"path": path, "event_type": "sensitive_action"}
                        }
                    )

            response.headers["X-Correlation-ID"] = correlation_id
            return response
            
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            
            # Format detailed error metrics for TRUE unhandled SERVER 500 EXCEPTIONS
            error_data = {
                "stream": "error",
                "path": path,
                "method": request.method,
                "error_type": type(e).__name__,
                "stack_trace": traceback.format_exc(),
                "duration_ms": round(process_time, 2)
            }
            
            # Use error logger stream explicitly
            _get_logger("error").error(
                f"Unhandled exception: {str(e)}", 
                extra={"correlation_id": correlation_id, "extra_info": error_data},
                exc_info=True
            )
            
            # Non-intrusive exception routing: just raise it
            # Let FastAPI and standard HTTP exception handlers do their job
            raise e

def handle_error(exception):
    """Fallback utility for other manual scopes"""
    return {"error": str(exception), "handled": True}

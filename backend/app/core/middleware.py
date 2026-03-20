"""Middleware components for the SolFoundry API.

This module provides:
- ErrorHandlingMiddleware: Global exception handling with structured responses
- CorrelationIdMiddleware: Request tracing with correlation IDs
- AccessLoggingMiddleware: HTTP request/response logging
"""

import time
import uuid
import traceback
from typing import Callable, Optional
from datetime import datetime, timezone

from fastapi import Request, Response, FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Message, Receive, Send, Scope
from pydantic import ValidationError as PydanticValidationError

from app.core.errors import (
    ErrorCode,
    ErrorResponse,
    AppException,
    InternalServerException,
    ValidationException,
    HTTP_STATUS_TO_ERROR_CODE,
)
from app.core.logging_config import (
    get_logger,
    get_correlation_id,
    set_correlation_id,
    clear_correlation_id,
    get_access_logger,
)


logger = get_logger(__name__)


class CorrelationIdMiddleware:
    """Middleware that adds a correlation ID to each request.
    
    The correlation ID is:
    1. Extracted from the X-Correlation-ID header if present
    2. Generated as a new UUID if not present
    3. Stored in a context variable for access in any part of the request
    4. Added to the response headers
    
    This enables request tracing across logs and services.
    """
    
    CORRELATION_ID_HEADER = "X-Correlation-ID"
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process the request and add correlation ID."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Get or generate correlation ID
        headers = dict(scope.get("headers", []))
        correlation_id = headers.get(self.CORRELATION_ID_HEADER.lower().encode(), b"").decode()
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        
        # Set in context for logging
        set_correlation_id(correlation_id)
        
        # Store correlation_id for later use
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["correlation_id"] = correlation_id
        
        # Wrapper to add correlation ID header to response
        async def send_with_correlation_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append([
                    self.CORRELATION_ID_HEADER.encode(),
                    correlation_id.encode()
                ])
                message["headers"] = headers
            await send(message)
        
        try:
            await self.app(scope, receive, send_with_correlation_id)
        finally:
            clear_correlation_id()


class ErrorHandlingMiddleware:
    """Global exception handling middleware.
    
    Catches all unhandled exceptions and converts them to structured
    JSON error responses. This ensures consistent error formatting
    across all endpoints.
    
    Exception handling order:
    1. AppException -> Use the exception's error code and status
    2. Pydantic ValidationError -> Convert to ValidationException
    3. Other exceptions -> Convert to InternalServerException
    
    All errors are logged with:
    - Correlation ID
    - Request path and method
    - Error details
    - Stack trace (for internal errors)
    """
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process the request and handle any exceptions."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Wrap the app to catch exceptions
        try:
            await self.app(scope, receive, send)
        except AppException as exc:
            await self._handle_app_exception(scope, exc, send)
        except PydanticValidationError as exc:
            await self._handle_validation_error(scope, exc, send)
        except Exception as exc:
            await self._handle_unexpected_error(scope, exc, send)
    
    async def _handle_app_exception(
        self, scope: Scope, exc: AppException, send: Send
    ) -> None:
        """Handle known application exceptions."""
        correlation_id = get_correlation_id() or scope.get("state", {}).get("correlation_id", "unknown")
        path = scope.get("path", "/")
        method = scope.get("method", "GET")
        
        # Log the error
        logger.error(
            f"Application error: {exc.message}",
            extra={"extra_data": {
                "error_code": exc.error_code.value,
                "status_code": exc.status_code,
                "path": path,
                "method": method,
            }}
        )
        
        # Build error response
        error_response = ErrorResponse(
            error=exc.error_code,
            message=exc.message,
            details=exc.details,
            correlation_id=correlation_id,
            path=path,
        )
        
        # Build response
        import json
        response_body = json.dumps(error_response.model_dump(exclude_none=True)).encode()
        response_headers = [
            [b"content-type", b"application/json"],
            [b"X-Correlation-ID".lower(), correlation_id.encode()],
        ]
        
        # Add any custom headers
        if exc.headers:
            for key, value in exc.headers.items():
                response_headers.append([key.lower().encode(), value.encode()])
        
        # Send response
        await send({
            "type": "http.response.start",
            "status": exc.status_code,
            "headers": response_headers,
        })
        await send({
            "type": "http.response.body",
            "body": response_body,
        })
    
    async def _handle_validation_error(
        self, scope: Scope, exc: PydanticValidationError, send: Send
    ) -> None:
        """Handle Pydantic validation errors."""
        from app.core.errors import ErrorDetail
        import json
        correlation_id = get_correlation_id() or scope.get("state", {}).get("correlation_id", "unknown")
        path = scope.get("path", "/")
        method = scope.get("method", "GET")
        
        # Convert Pydantic errors to ErrorDetail list
        details = []
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error["loc"])
            details.append(ErrorDetail(
                field=field,
                message=error["msg"],
                code=error["type"],
            ))
        
        validation_exc = ValidationException(
            message="Validation failed",
            details=details,
        )
        
        # Log the error
        logger.warning(
            "Validation error",
            extra={"extra_data": {
                "path": path,
                "method": method,
                "errors": exc.errors(),
            }}
        )
        
        error_response = validation_exc.to_response(
            correlation_id=correlation_id,
            path=path,
        )
        
        response_body = json.dumps(error_response.model_dump(exclude_none=True)).encode()
        
        await send({
            "type": "http.response.start",
            "status": 422,
            "headers": [
                [b"content-type", b"application/json"],
                [b"X-Correlation-ID".lower(), correlation_id.encode()],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": response_body,
        })
    
    async def _handle_unexpected_error(
        self, scope: Scope, exc: Exception, send: Send
    ) -> None:
        """Handle unexpected exceptions."""
        import json
        correlation_id = get_correlation_id() or scope.get("state", {}).get("correlation_id", "unknown")
        path = scope.get("path", "/")
        method = scope.get("method", "GET")
        
        # Log with full traceback
        logger.exception(
            f"Unexpected error: {type(exc).__name__}: {str(exc)}",
            extra={"extra_data": {
                "path": path,
                "method": method,
                "exception_type": type(exc).__name__,
            }}
        )
        
        internal_exc = InternalServerException(
            message="An unexpected error occurred. Please try again later.",
        )
        
        error_response = internal_exc.to_response(
            correlation_id=correlation_id,
            path=path,
        )
        
        response_body = json.dumps(error_response.model_dump(exclude_none=True)).encode()
        
        await send({
            "type": "http.response.start",
            "status": 500,
            "headers": [
                [b"content-type", b"application/json"],
                [b"X-Correlation-ID".lower(), correlation_id.encode()],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": response_body,
        })


class AccessLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses.
    
    Logs:
    - Request method, path, query params
    - Response status code and duration
    - Correlation ID
    - Client IP address
    
    This creates an access log stream separate from application logs.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.access_logger = get_access_logger()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Log the request and response."""
        start_time = time.time()
        correlation_id = get_correlation_id()
        
        # Log request
        self.access_logger.info(
            f"Request: {request.method} {request.url.path}",
            extra={"extra_data": {
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params),
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("user-agent", ""),
            }}
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Log response
        log_level = "info" if response.status_code < 400 else "warning"
        getattr(self.access_logger, log_level)(
            f"Response: {request.method} {request.url.path} {response.status_code}",
            extra={"extra_data": {
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "client_ip": self._get_client_ip(request),
            }}
        )
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, handling proxies."""
        # Check X-Forwarded-For header first (for reverse proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Fall back to direct client
        if request.client:
            return request.client.host
        
        return "unknown"
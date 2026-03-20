"""Core module for error handling, logging, and middleware."""

from app.core.errors import (
    ErrorCode,
    ErrorResponse,
    AppException,
    NotFoundException,
    ValidationException,
    ConflictException,
    UnauthorizedException,
    InternalServerException,
)
from app.core.logging_config import setup_logging, get_logger, correlation_id_context
from app.core.middleware import ErrorHandlingMiddleware, CorrelationIdMiddleware
from app.core.audit import AuditLogger, AuditAction, audit_log

__all__ = [
    # Errors
    "ErrorCode",
    "ErrorResponse",
    "AppException",
    "NotFoundException",
    "ValidationException",
    "ConflictException",
    "UnauthorizedException",
    "InternalServerException",
    # Logging
    "setup_logging",
    "get_logger",
    "correlation_id_context",
    # Middleware
    "ErrorHandlingMiddleware",
    "CorrelationIdMiddleware",
    # Audit
    "AuditLogger",
    "AuditAction",
    "audit_log",
]
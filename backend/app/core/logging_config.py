"""Structured logging configuration for SolFoundry.

This module provides a centralized logging system with:
- Structured JSON log output
- Correlation IDs for request tracing
- Separate log streams (application, access, error, audit)
- Configurable log levels and rotation
- Context-aware logging with request metadata

Log Streams:
- application: General application logs (INFO and above)
- access: HTTP request/response logs
- error: Error and exception logs (ERROR and above)
- audit: Security-sensitive operations (auth, payouts, state changes)

Usage:
    from app.core.logging_config import get_logger, setup_logging
    
    # Initialize logging at startup
    setup_logging()
    
    # Get a logger for your module
    logger = get_logger(__name__)
    
    # Log with structured context
    logger.info("Processing bounty", extra={
        "bounty_id": "abc123",
        "action": "claim",
    })
"""

import os
import sys
import json
import logging
import logging.config
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from contextvars import ContextVar
from pathlib import Path
from functools import lru_cache


# Context variable for correlation ID tracking across async boundaries
correlation_id_context: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


class LogLevel:
    """Log level constants."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogStream:
    """Log stream names for different log types."""
    APPLICATION = "application"
    ACCESS = "access"
    ERROR = "error"
    AUDIT = "audit"


@lru_cache(maxsize=128)
def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for the given module name.
    
    The logger is configured to output structured JSON logs.
    Use this instead of logging.getLogger() directly.
    
    Args:
        name: Usually __name__ of the calling module
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def get_correlation_id() -> Optional[str]:
    """Get the current correlation ID from context.
    
    Returns:
        The correlation ID for the current request, or None if not set
    """
    return correlation_id_context.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set the correlation ID for the current request context.
    
    Args:
        correlation_id: Unique identifier for request tracing
    """
    correlation_id_context.set(correlation_id)


def clear_correlation_id() -> None:
    """Clear the correlation ID from the current context."""
    correlation_id_context.set(None)


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs logs as structured JSON.
    
    Each log record is converted to a JSON object with:
    - timestamp: ISO 8601 timestamp
    - level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - logger: Logger name
    - message: Log message
    - correlation_id: Request correlation ID (if available)
    - extra: Additional structured context
    - exception: Exception details (if present)
    """
    
    def __init__(self, stream_type: str = LogStream.APPLICATION):
        super().__init__()
        self.stream_type = stream_type
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as JSON."""
        # Base log entry
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "stream": self.stream_type,
        }
        
        # Add correlation ID if available
        correlation_id = get_correlation_id()
        if correlation_id:
            log_entry["correlation_id"] = correlation_id
        
        # Add source location for errors
        if record.levelno >= logging.ERROR:
            log_entry["source"] = {
                "file": record.filename,
                "line": record.lineno,
                "function": record.funcName,
            }
        
        # Add extra fields
        if hasattr(record, "extra_data") and record.extra_data:
            log_entry["data"] = record.extra_data
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info),
            }
        
        return json.dumps(log_entry, default=str)


class AuditFormatter(StructuredFormatter):
    """Formatter for audit logs with additional security context.
    
    Audit logs include:
    - actor: Who performed the action
    - action: What action was taken
    - resource: What resource was affected
    - result: Success or failure
    - ip_address: Source IP (if available)
    """
    
    def __init__(self):
        super().__init__(stream_type=LogStream.AUDIT)
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the audit log record with security context."""
        log_entry = json.loads(super().format(record))
        
        # Add audit-specific fields
        audit_fields = ["actor", "action", "resource", "resource_id", "result", "ip_address", "user_agent"]
        for field in audit_fields:
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)
        
        return json.dumps(log_entry, default=str)


class ContextFilter(logging.Filter):
    """Filter that adds context information to log records."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add correlation ID to the record."""
        record.correlation_id = get_correlation_id()
        return True


def get_log_directory() -> Path:
    """Get the log directory path, creating it if necessary."""
    log_dir = Path(os.getenv("LOG_DIR", "logs"))
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_log_retention_days() -> int:
    """Get log retention period in days from environment."""
    return int(os.getenv("LOG_RETENTION_DAYS", "30"))


def get_log_max_bytes() -> int:
    """Get max log file size in bytes from environment."""
    return int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024)))  # 10MB default


def get_log_backup_count() -> int:
    """Get number of backup log files to keep."""
    return int(os.getenv("LOG_BACKUP_COUNT", "5"))


def get_log_level() -> str:
    """Get the log level from environment."""
    return os.getenv("LOG_LEVEL", "INFO").upper()


def should_log_to_file() -> bool:
    """Check if file logging is enabled."""
    return os.getenv("LOG_TO_FILE", "false").lower() == "true"


def should_log_to_stdout() -> bool:
    """Check if stdout logging is enabled."""
    return os.getenv("LOG_TO_STDOUT", "true").lower() == "true"


def setup_logging() -> None:
    """Configure the logging system for the application.
    
    Sets up:
    - Root logger with appropriate level
    - Separate handlers for each log stream
    - JSON structured output
    - File rotation (if enabled)
    - Context filters for correlation IDs
    
    This should be called once at application startup.
    """
    log_level = get_log_level()
    log_dir = get_log_directory()
    
    # Create formatters
    app_formatter = StructuredFormatter(LogStream.APPLICATION)
    access_formatter = StructuredFormatter(LogStream.ACCESS)
    error_formatter = StructuredFormatter(LogStream.ERROR)
    audit_formatter = AuditFormatter()
    
    # Configure handlers
    handlers: Dict[str, Any] = {}
    
    # Console handlers
    if should_log_to_stdout():
        handlers["console_app"] = {
            "class": "logging.StreamHandler",
            "stream": sys.stdout,
            "formatter": "structured",
            "level": log_level,
        }
        
        handlers["console_error"] = {
            "class": "logging.StreamHandler",
            "stream": sys.stderr,
            "formatter": "error",
            "level": "ERROR",
        }
    
    # File handlers with rotation
    if should_log_to_file():
        handlers["file_app"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(log_dir / "application.log"),
            "maxBytes": get_log_max_bytes(),
            "backupCount": get_log_backup_count(),
            "formatter": "structured",
            "level": log_level,
        }
        
        handlers["file_access"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(log_dir / "access.log"),
            "maxBytes": get_log_max_bytes(),
            "backupCount": get_log_backup_count(),
            "formatter": "access",
            "level": "INFO",
        }
        
        handlers["file_error"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(log_dir / "error.log"),
            "maxBytes": get_log_max_bytes(),
            "backupCount": get_log_backup_count(),
            "formatter": "error",
            "level": "ERROR",
        }
        
        handlers["file_audit"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(log_dir / "audit.log"),
            "maxBytes": get_log_max_bytes(),
            "backupCount": get_log_backup_count(),
            "formatter": "audit",
            "level": "INFO",
        }
    
    # Logging configuration
    config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structured": {
                "()": StructuredFormatter,
                "stream_type": LogStream.APPLICATION,
            },
            "access": {
                "()": StructuredFormatter,
                "stream_type": LogStream.ACCESS,
            },
            "error": {
                "()": StructuredFormatter,
                "stream_type": LogStream.ERROR,
            },
            "audit": {
                "()": AuditFormatter,
            },
        },
        "handlers": handlers,
        "loggers": {
            "": {  # Root logger
                "level": log_level,
                "handlers": list(handlers.keys()),
                "propagate": False,
            },
            "app": {
                "level": log_level,
                "propagate": True,
            },
            "app.api": {
                "level": log_level,
                "propagate": True,
            },
            "app.services": {
                "level": log_level,
                "propagate": True,
            },
            "uvicorn": {
                "level": "WARNING",
                "propagate": True,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "propagate": True,
            },
        },
    }
    
    logging.config.dictConfig(config)
    
    # Log startup message
    logger = get_logger(__name__)
    logger.info(
        "Logging system initialized",
        extra={"extra_data": {
            "log_level": log_level,
            "log_to_file": should_log_to_file(),
            "log_to_stdout": should_log_to_stdout(),
        }}
    )


def get_access_logger() -> logging.Logger:
    """Get the access logger for HTTP request logging."""
    logger = logging.getLogger("access")
    logger.propagate = False
    return logger


def get_error_logger() -> logging.Logger:
    """Get the error logger for exception logging."""
    return logging.getLogger("error")


def get_audit_logger() -> logging.Logger:
    """Get the audit logger for security-sensitive operations."""
    return logging.getLogger("audit")
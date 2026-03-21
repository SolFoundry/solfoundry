"""Core utilities for logging config."""
import logging
import os
import sys
from logging.handlers import TimedRotatingFileHandler
import structlog
from pythonjsonlogger import jsonlogger

LOG_DIR = os.getenv("LOG_DIR", "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

def setup_logging():
    """Configure structured logging for the application."""
    
    # 1. Standard Logging Configuration
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    # Handler for application logs (JSON)
    app_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "application.log"),
        when="midnight",
        interval=1,
        backupCount=7
    )
    app_handler.setFormatter(jsonlogger.JsonFormatter())
    
    # Handler for access logs (JSON)
    access_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "access.log"),
        when="midnight",
        interval=1,
        backupCount=7
    )
    access_handler.setFormatter(jsonlogger.JsonFormatter())

    # Handler for error logs (JSON)
    error_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "error.log"),
        when="midnight",
        interval=1,
        backupCount=7
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(jsonlogger.JsonFormatter())

    # Handler for audit logs (JSON)
    audit_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "audit.log"),
        when="midnight",
        interval=1,
        backupCount=30 # Longer retention for audit
    )
    audit_handler.setFormatter(jsonlogger.JsonFormatter())

    # Console handler (Human-readable in Dev, JSON in Prod)
    console_handler = logging.StreamHandler(sys.stdout)
    if os.getenv("ENV") == "production":
        console_handler.setFormatter(jsonlogger.JsonFormatter())
    else:
        # Use structlog's ConsoleRenderer for dev
        pass 

    # Root logger config
    logging.basicConfig(
        level=LOG_LEVEL,
        format="%(message)s",
        handlers=[console_handler, app_handler, error_handler]
    )

    # Specific loggers
    logging.getLogger("uvicorn.access").handlers = [access_handler]
    audit_log = logging.getLogger("audit")
    audit_log.handlers = [audit_handler]
    audit_log.setLevel(logging.INFO)
    audit_log.propagate = False

    # 2. Structlog Configuration
    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Formatter for structlog -> stdlib
    is_prod = os.getenv("ENV") == "production"
    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer() if is_prod else structlog.dev.ConsoleRenderer(),
    )
    console_handler.setFormatter(formatter)
    app_handler.setFormatter(jsonlogger.JsonFormatter())
    access_handler.setFormatter(jsonlogger.JsonFormatter())
    error_handler.setFormatter(jsonlogger.JsonFormatter())
    audit_handler.setFormatter(jsonlogger.JsonFormatter())

def get_audit_logger():
    """Return a logger specifically for audit events."""
    return structlog.get_logger("audit")

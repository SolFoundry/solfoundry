"""Global exception handlers that return structured JSON error responses.

Registers handlers for:
  - ``RequestValidationError`` (422) — Pydantic / query-param validation
  - ``HTTPException``               — FastAPI's standard HTTP errors
  - ``Exception``                    — Catch-all for unhandled errors (500)

Every error response body follows the schema::

    {
        "error": {
            "code": "<HTTP_STATUS>",
            "message": "<human-readable>",
            "correlation_id": "<request trace id>",
            "details": ...          // only for validation errors
        }
    }
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.correlation import get_correlation_id

error_logger = logging.getLogger("solfoundry.error")


def _build_error_body(code: int, message: str, details=None) -> dict:
    body: dict = {
        "error": {
            "code": code,
            "message": message,
            "correlation_id": get_correlation_id() or "-",
        }
    }
    if details is not None:
        body["error"]["details"] = details
    return body


def _sanitize_errors(errors: list) -> list:
    """Convert validation error details to JSON-safe dicts."""
    safe = []
    for err in errors:
        entry = {}
        for k, v in err.items():
            if k == "ctx" and isinstance(v, dict):
                entry[k] = {ck: str(cv) for ck, cv in v.items()}
            else:
                try:
                    import json as _json
                    _json.dumps(v)
                    entry[k] = v
                except (TypeError, ValueError):
                    entry[k] = str(v)
        safe.append(entry)
    return safe


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = _sanitize_errors(exc.errors())
    error_logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url.path,
        errors,
        extra={"method": request.method, "path": str(request.url.path)},
    )
    return JSONResponse(
        status_code=422,
        content=_build_error_body(422, "Validation error", errors),
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    level = logging.WARNING if exc.status_code < 500 else logging.ERROR
    error_logger.log(
        level,
        "HTTP %d on %s %s: %s",
        exc.status_code,
        request.method,
        request.url.path,
        exc.detail,
        extra={
            "method": request.method,
            "path": str(request.url.path),
            "status_code": exc.status_code,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_build_error_body(exc.status_code, str(exc.detail)),
        headers=getattr(exc, "headers", None),
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    error_logger.critical(
        "Unhandled %s on %s %s: %s",
        type(exc).__name__,
        request.method,
        request.url.path,
        exc,
        exc_info=True,
        extra={
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 500,
        },
    )
    return JSONResponse(
        status_code=500,
        content=_build_error_body(500, "Internal server error"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to *app*."""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

"""Input sanitization middleware for XSS and SQL injection prevention.

Provides defense-in-depth input validation by scanning request bodies and
query parameters for common attack patterns before they reach route handlers.

Attack vectors mitigated:
- Cross-Site Scripting (XSS): <script>, javascript: URIs, event handlers
- SQL Injection: UNION SELECT, DROP TABLE, OR 1=1, comment sequences
- HTML Injection: Malicious HTML tags and attributes
- Solana wallet address validation: Base58 format enforcement

This middleware operates as a safety net. Primary defense remains at the
model/service layer (Pydantic validators, parameterized queries via SQLAlchemy).

References:
    - OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Scripting_Prevention_Cheat_Sheet.html
    - OWASP SQL Injection: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
"""

import html
import json
import logging
import re
from typing import Callable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Solana wallet address pattern: Base58 encoding, 32-44 characters
SOLANA_WALLET_PATTERN: re.Pattern = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")

# XSS attack patterns (case-insensitive)
XSS_PATTERNS: list[re.Pattern] = [
    re.compile(r"<\s*script\b", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on(load|error|click|mouseover|focus|blur|submit|change)\s*=", re.IGNORECASE),
    re.compile(r"<\s*iframe\b", re.IGNORECASE),
    re.compile(r"<\s*object\b", re.IGNORECASE),
    re.compile(r"<\s*embed\b", re.IGNORECASE),
    re.compile(r"<\s*svg\b[^>]*\bon\w+\s*=", re.IGNORECASE),
    re.compile(r"expression\s*\(", re.IGNORECASE),
    re.compile(r"url\s*\(\s*['\"]?\s*javascript:", re.IGNORECASE),
    re.compile(r"<\s*img\b[^>]*\bon\w+\s*=", re.IGNORECASE),
]

# SQL injection patterns (case-insensitive)
SQL_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bUNION\s+(ALL\s+)?SELECT\b", re.IGNORECASE),
    re.compile(r"\bDROP\s+(TABLE|DATABASE|INDEX)\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+\w+\s+SET\b", re.IGNORECASE),
    re.compile(r"\bEXEC(UTE)?\s*\(", re.IGNORECASE),
    re.compile(r";\s*--", re.IGNORECASE),
    re.compile(r"'\s*OR\s+'?\d*'?\s*=\s*'?\d*", re.IGNORECASE),
    re.compile(r"'\s*OR\s+1\s*=\s*1", re.IGNORECASE),
    re.compile(r"/\*.*?\*/", re.IGNORECASE | re.DOTALL),
    re.compile(r"\bALTER\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bCREATE\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bxp_cmdshell\b", re.IGNORECASE),
    re.compile(r"\bSLEEP\s*\(\s*\d+\s*\)", re.IGNORECASE),
    re.compile(r"\bBENCHMARK\s*\(", re.IGNORECASE),
    re.compile(r"\bWAITFOR\s+DELAY\b", re.IGNORECASE),
]

# Paths that bypass sanitization (webhook payloads need raw access)
BYPASS_PATHS: tuple[str, ...] = (
    "/api/webhooks/",
    "/health",
)


def is_valid_solana_wallet(address: str) -> bool:
    """Validate that a string is a properly formatted Solana wallet address.

    Checks Base58 encoding format (excludes 0, O, I, l characters) and
    length constraints (32-44 characters for Solana public keys).

    Args:
        address: The wallet address string to validate.

    Returns:
        bool: True if the address matches the expected Solana wallet format.
    """
    return bool(SOLANA_WALLET_PATTERN.match(address))


def sanitize_html(text: str) -> str:
    """Escape HTML special characters to prevent XSS when rendering user content.

    Converts &, <, >, ", and ' to their HTML entity equivalents.

    Args:
        text: The raw user input string to sanitize.

    Returns:
        str: The HTML-escaped string safe for rendering in HTML context.
    """
    return html.escape(text, quote=True)


def detect_xss_pattern(text: str) -> Optional[str]:
    """Scan text for known XSS attack patterns.

    Checks the input against a comprehensive list of XSS vectors including
    script tags, javascript: URIs, event handler attributes, and CSS expressions.

    Args:
        text: The string to scan for XSS patterns.

    Returns:
        Optional[str]: The matched pattern description if an attack is detected,
            or None if the input appears safe.
    """
    for pattern in XSS_PATTERNS:
        if pattern.search(text):
            return pattern.pattern
    return None


def detect_sql_injection(text: str) -> Optional[str]:
    """Scan text for known SQL injection patterns.

    Checks the input against common SQL injection vectors including UNION
    SELECT, DROP TABLE, boolean-based blind injection, and time-based blind
    injection patterns.

    Args:
        text: The string to scan for SQL injection patterns.

    Returns:
        Optional[str]: The matched pattern description if an attack is detected,
            or None if the input appears safe.
    """
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern.search(text):
            return pattern.pattern
    return None


def scan_value(value: str) -> Optional[str]:
    """Scan a single string value for both XSS and SQL injection patterns.

    This is the primary scanning function used by the middleware to check
    individual field values from request bodies and query parameters.

    Args:
        value: The string value to scan.

    Returns:
        Optional[str]: A description of the detected threat, or None if safe.
    """
    xss_match = detect_xss_pattern(value)
    if xss_match:
        return f"XSS pattern detected: {xss_match}"

    sql_match = detect_sql_injection(value)
    if sql_match:
        return f"SQL injection pattern detected: {sql_match}"

    return None


def _scan_dict(data: dict, path: str = "") -> Optional[str]:
    """Recursively scan all string values in a dictionary for attack patterns.

    Traverses nested dictionaries and lists to check every string value.

    Args:
        data: The dictionary to scan (typically a parsed JSON request body).
        path: The current key path for logging (e.g., "body.description").

    Returns:
        Optional[str]: A description of the first detected threat with the
            field path, or None if all values appear safe.
    """
    for key, value in data.items():
        current_path = f"{path}.{key}" if path else key
        if isinstance(value, str):
            threat = scan_value(value)
            if threat:
                return f"Field '{current_path}': {threat}"
        elif isinstance(value, dict):
            result = _scan_dict(value, current_path)
            if result:
                return result
        elif isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, str):
                    threat = scan_value(item)
                    if threat:
                        return f"Field '{current_path}[{index}]': {threat}"
                elif isinstance(item, dict):
                    result = _scan_dict(item, f"{current_path}[{index}]")
                    if result:
                        return result
    return None


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware that scans request inputs for XSS and SQL injection attacks.

    Inspects both query parameters and JSON request bodies before they reach
    route handlers. Requests containing detected attack patterns are rejected
    with HTTP 400. Webhook endpoints are exempted since they receive
    third-party payloads that may contain code snippets.

    This provides defense-in-depth alongside Pydantic validation and
    SQLAlchemy's parameterized queries.

    Note:
        This middleware only processes application/json content types.
        File uploads and form data are handled by their respective endpoints.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Scan request inputs and reject requests containing attack patterns.

        Args:
            request: The incoming HTTP request to scan.
            call_next: The next middleware or route handler.

        Returns:
            Response: Either the application response (if clean) or a 400 error
                response if an attack pattern is detected.
        """
        # Skip sanitization for exempted paths
        if any(request.url.path.startswith(p) for p in BYPASS_PATHS):
            return await call_next(request)

        # Scan query parameters
        for param_name, param_value in request.query_params.items():
            threat = scan_value(param_value)
            if threat:
                logger.warning(
                    "Blocked request: query param '%s' from %s: %s",
                    param_name,
                    request.client.host if request.client else "unknown",
                    threat,
                )
                return Response(
                    content=json.dumps({"detail": "Request contains prohibited content"}),
                    status_code=400,
                    media_type="application/json",
                )

        # Scan JSON request body for mutation requests
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body = await request.body()
                    if body:
                        data = json.loads(body)
                        if isinstance(data, dict):
                            threat = _scan_dict(data)
                            if threat:
                                logger.warning(
                                    "Blocked request: body from %s %s: %s",
                                    request.method,
                                    request.url.path,
                                    threat,
                                )
                                return Response(
                                    content=json.dumps({
                                        "detail": "Request contains prohibited content"
                                    }),
                                    status_code=400,
                                    media_type="application/json",
                                )
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Let the framework handle malformed JSON
                    pass

        return await call_next(request)

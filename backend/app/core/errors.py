"""Structured error handling for the SolFoundry API.

This module provides a centralized error handling system with:
- Standardized error codes and messages
- Structured JSON error responses
- Custom exception hierarchy
- Request correlation for debugging
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class ErrorCode(str, Enum):
    """Standardized error codes for API responses.
    
    Error codes follow the pattern: DOMAIN_SPECIFIC_ERROR
    This makes it easy to identify the source and type of error.
    """
    # General errors (1xxx)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    RATE_LIMITED = "RATE_LIMITED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    
    # Bounty errors (2xxx)
    BOUNTY_NOT_FOUND = "BOUNTY_NOT_FOUND"
    BOUNTY_ALREADY_CLAIMED = "BOUNTY_ALREADY_CLAIMED"
    BOUNTY_INVALID_STATUS = "BOUNTY_INVALID_STATUS"
    BOUNTY_INVALID_TIER = "BOUNTY_INVALID_TIER"
    BOUNTY_EXPIRED = "BOUNTY_EXPIRED"
    
    # Contributor errors (3xxx)
    CONTRIBUTOR_NOT_FOUND = "CONTRIBUTOR_NOT_FOUND"
    CONTRIBUTOR_ALREADY_EXISTS = "CONTRIBUTOR_ALREADY_EXISTS"
    CONTRIBUTOR_INSUFFICIENT_REPUTATION = "CONTRIBUTOR_INSUFFICIENT_REPUTATION"
    
    # Webhook errors (4xxx)
    WEBHOOK_SIGNATURE_INVALID = "WEBHOOK_SIGNATURE_INVALID"
    WEBHOOK_PAYLOAD_INVALID = "WEBHOOK_PAYLOAD_INVALID"
    WEBHOOK_DELIVERY_FAILED = "WEBHOOK_DELIVERY_FAILED"
    
    # Database errors (5xxx)
    DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR"
    DATABASE_QUERY_ERROR = "DATABASE_QUERY_ERROR"
    
    # Auth errors (6xxx)
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_WALLET_VERIFICATION_FAILED = "AUTH_WALLET_VERIFICATION_FAILED"


class ErrorDetail(BaseModel):
    """Detailed error information for a specific field or parameter."""
    field: str = Field(..., description="The field or parameter that caused the error")
    message: str = Field(..., description="Human-readable error message")
    code: Optional[str] = Field(None, description="Specific error code for this field")
    value: Optional[Any] = Field(None, description="The invalid value that was provided")


class ErrorResponse(BaseModel):
    """Standardized error response format for all API errors.
    
    This ensures consistent error handling across all endpoints,
    making it easier for clients to parse and handle errors.
    
    Attributes:
        error: The primary error code
        message: Human-readable error message
        details: Optional list of specific error details (e.g., validation errors)
        correlation_id: Request correlation ID for debugging
        timestamp: When the error occurred
        path: The request path that caused the error
        documentation_url: Optional link to documentation for this error
    """
    error: ErrorCode = Field(..., description="Error code identifying the type of error")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[List[ErrorDetail]] = Field(
        None, 
        description="Detailed error information for specific fields"
    )
    correlation_id: Optional[str] = Field(
        None, 
        description="Request correlation ID for debugging and support"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="ISO 8601 timestamp of when the error occurred"
    )
    path: Optional[str] = Field(
        None, 
        description="The request path that caused the error"
    )
    documentation_url: Optional[str] = Field(
        None,
        description="Link to documentation for this error type"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "error": "VALIDATION_ERROR",
                "message": "Invalid request parameters",
                "details": [
                    {
                        "field": "tier",
                        "message": "Tier must be between 1 and 3",
                        "code": "INVALID_RANGE",
                        "value": 5
                    }
                ],
                "correlation_id": "abc123-def456-ghi789",
                "timestamp": "2024-01-15T10:30:00Z",
                "path": "/api/bounties",
                "documentation_url": "https://docs.solfoundry.org/errors/VALIDATION_ERROR"
            }
        }
    }


class AppException(Exception):
    """Base exception for all SolFoundry API errors.
    
    Provides a consistent interface for error handling across the application.
    All custom exceptions should inherit from this class.
    
    Attributes:
        error_code: The error code for this exception
        message: Human-readable error message
        status_code: HTTP status code to return
        details: Optional list of error details
        headers: Optional HTTP headers to include in the response
    """
    
    def __init__(
        self,
        error_code: ErrorCode,
        message: str,
        status_code: int = 500,
        details: Optional[List[ErrorDetail]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details
        self.headers = headers
        super().__init__(message)
    
    def to_response(self, correlation_id: Optional[str] = None, path: Optional[str] = None) -> ErrorResponse:
        """Convert exception to ErrorResponse model."""
        return ErrorResponse(
            error=self.error_code,
            message=self.message,
            details=self.details,
            correlation_id=correlation_id,
            path=path,
        )


class NotFoundException(AppException):
    """Exception for resource not found errors."""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.NOT_FOUND,
            message=f"{resource_type} with id '{resource_id}' not found",
            status_code=404,
            details=details,
        )


class ValidationException(AppException):
    """Exception for validation errors."""
    
    def __init__(
        self,
        message: str,
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.VALIDATION_ERROR,
            message=message,
            status_code=422,
            details=details,
        )


class ConflictException(AppException):
    """Exception for conflict errors (e.g., duplicate resources)."""
    
    def __init__(
        self,
        message: str,
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.CONFLICT,
            message=message,
            status_code=409,
            details=details,
        )


class UnauthorizedException(AppException):
    """Exception for authentication errors."""
    
    def __init__(
        self,
        message: str = "Authentication required",
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.UNAUTHORIZED,
            message=message,
            status_code=401,
            details=details,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    """Exception for authorization errors."""
    
    def __init__(
        self,
        message: str = "Access denied",
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.FORBIDDEN,
            message=message,
            status_code=403,
            details=details,
        )


class InternalServerException(AppException):
    """Exception for internal server errors."""
    
    def __init__(
        self,
        message: str = "An unexpected error occurred",
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=message,
            status_code=500,
            details=details,
        )


class ServiceUnavailableException(AppException):
    """Exception for service unavailability errors."""
    
    def __init__(
        self,
        service_name: str,
        message: Optional[str] = None,
        details: Optional[List[ErrorDetail]] = None,
    ):
        super().__init__(
            error_code=ErrorCode.SERVICE_UNAVAILABLE,
            message=message or f"Service '{service_name}' is temporarily unavailable",
            status_code=503,
            details=details,
            headers={"Retry-After": "60"},
        )


# Mapping of standard HTTP exceptions to error codes
HTTP_STATUS_TO_ERROR_CODE: Dict[int, ErrorCode] = {
    400: ErrorCode.VALIDATION_ERROR,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION_ERROR,
    429: ErrorCode.RATE_LIMITED,
    500: ErrorCode.INTERNAL_ERROR,
    503: ErrorCode.SERVICE_UNAVAILABLE,
}
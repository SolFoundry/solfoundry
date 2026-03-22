"""Standard error response models for API documentation.

Provides consistent error response schemas used in OpenAPI docs
and audit logging across all API endpoints.
"""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error response wrapper for API endpoints.

    Used in OpenAPI schema ``responses`` parameter to document error
    response shapes consistently across all endpoints.
    """

    error: str = Field(..., description="Human-readable error message")
    code: str = Field(
        ...,
        description="Machine-readable error code (e.g., NOT_FOUND, UNAUTHORIZED)",
    )
    request_id: Optional[str] = Field(
        None, description="Unique identifier for tracing the request"
    )
    details: Optional[Dict[str, Any]] = Field(
        None, description="Optional structured error details"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "error": "Bounty with ID '123' not found",
                "code": "NOT_FOUND",
                "request_id": "req-abcd-1234",
                "details": {"id": "123"},
            }
        }
    }


class AuditLogEntry(BaseModel):
    """Record representing a single audit log entry.

    Used by the audit module to structure log events for security-sensitive
    operations.
    """

    event: str = Field(
        ...,
        description="The name of the audit event",
        examples=["bounty_created"],
    )
    user_id: Optional[str] = Field(
        None, description="The UUID of the user who performed the action"
    )
    wallet_address: Optional[str] = Field(
        None, description="The Solana wallet address used"
    )
    resource_id: Optional[str] = Field(
        None,
        description="The ID of the resource affected (e.g., bounty_id, payout_id)",
    )
    details: Optional[dict] = Field(
        None, description="Additional structured metadata for the audit event"
    )
    status: str = Field(
        "success", description="Status of the operation (success or failure)"
    )

"""Standard error response models for API documentation."""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error response wrapper."""
    
    error: str = Field(..., description="Human-readable error message")
    code: str = Field(..., description="Machine-readable error code (e.g., NOT_FOUND, UNAUTHORIZED)")
    request_id: Optional[str] = Field(None, description="Unique identifier for tracing the request")
    details: Optional[Dict[str, Any]] = Field(None, description="Optional structured error details")

    model_config = {
        "json_schema_extra": {
            "example": {
                "error": "Bounty with ID '123' not found",
                "code": "NOT_FOUND",
                "request_id": "req-abcd-1234",
                "details": {"id": "123"}
            }
        }
    }


class AuditLogEntry(BaseModel):
    """Record representing a single audit log entry."""
    
    event: str = Field(..., description="The name of the audit event", examples=["bounty_created"])
    user_id: Optional[str] = Field(None, description="The UUID of the user who performed the action")
    wallet_address: Optional[str] = Field(None, description="The Solana wallet address used")
    resource_id: Optional[str] = Field(None, description="The ID of the resource affected (e.g., bounty_id, payout_id)")
    details: Optional[dict] = Field(None, description="Additional structured metadata for the audit event")
    status: str = Field("success", description="Status of the operation (success or failure)")


class ValidationErrorDetail(BaseModel):
    """Detailed validation error for a specific field."""
    
    loc: list[str | int] = Field(..., description="Location of the error (e.g., ['body', 'reward_amount'])")
    msg: str = Field(..., description="Validation error message")
    type: str = Field(..., description="Type of validation error (e.g., value_error.missing)")


class HTTPValidationError(BaseModel):
    """Specific error response for 422 Unprocessable Entity."""
    
    detail: list[ValidationErrorDetail] = Field(..., description="List of specific validation errors")

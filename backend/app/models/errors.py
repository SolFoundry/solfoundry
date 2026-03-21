from pydantic import BaseModel
from typing import Optional

class ErrorResponse(BaseModel):
    error: str
    request_id: Optional[str] = None
    code: str
    details: Optional[dict] = None

class AuditLogEntry(BaseModel):
    event: str
    user_id: Optional[str] = None
    wallet_address: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    status: str = "success"

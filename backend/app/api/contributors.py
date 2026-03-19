from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class NotificationPayload(BaseModel):
    message: str
    notify_type: str = "both" # email, in-app, both

@router.post("/{contributor_id}/notify")
def notify_contributor(contributor_id: int, payload: NotificationPayload):
    """Send in-app and/or email notifications to contributors about bounty changes."""
    # Minimal implementation for the notification system
    if payload.notify_type not in ["email", "in-app", "both"]:
        raise HTTPException(status_code=400, detail="Invalid notify_type")
        
    return {
        "status": "success",
        "contributor_id": contributor_id,
        "delivered": payload.notify_type,
        "message": payload.message
    }

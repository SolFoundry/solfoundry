"""User-facing anti-gaming endpoints (appeals)."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.errors import ErrorResponse
from app.models.user import UserResponse
from app.services import anti_gaming_service

router = APIRouter(prefix="/anti-gaming", tags=["anti-gaming"])


class AppealCreateRequest(BaseModel):
    message: str = Field(..., min_length=10, max_length=8000)
    related_audit_id: Optional[UUID] = Field(
        None, description="Optional anti-gaming audit row tied to this appeal"
    )


class AppealCreateResponse(BaseModel):
    id: str
    status: str


@router.post(
    "/appeals",
    response_model=AppealCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Appeal an anti-gaming decision",
    description="Submit a false-positive appeal for manual admin review.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def create_appeal(
    body: AppealCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: UserResponse = Depends(get_current_user),
) -> AppealCreateResponse:
    row = await anti_gaming_service.create_appeal(
        db,
        user_id=str(user.id),
        message=body.message,
        related_audit_id=body.related_audit_id,
    )
    await db.commit()
    return AppealCreateResponse(id=str(row.id), status=row.status)

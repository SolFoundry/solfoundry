"""Email preferences per contributor.

Controls which notification types trigger emails vs. in-app only.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlmodel import JSON, Column, Field as SQLField, SQLModel


class EmailNotificationType(str, Enum):
    BOUNTY_CLAIMED = "bounty_claimed"
    SUBMISSION_RECEIVED = "submission_received"
    SUBMISSION_APPROVED = "submission_approved"
    SUBMISSION_REJECTED = "submission_rejected"
    SUBMISSION_DISPUTED = "submission_disputed"
    REVIEW_COMPLETE = "review_complete"
    PAYOUT_CONFIRMED = "payout_confirmed"
    PAYOUT_INITIATED = "payout_initiated"
    PAYOUT_FAILED = "payout_failed"
    RANK_CHANGED = "rank_changed"
    AUTO_APPROVED = "auto_approved"
    BOUNTY_EXPIRED = "bounty_expired"


class EmailPreferencesModel(SQLModel, table=True):
    __tablename__ = "email_preferences"

    id: Optional[str] = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(unique=True, index=True, nullable=False)
    preferences: dict[str, bool] = Field(default_factory=dict, sa_column=Column(JSON))
    email_enabled: bool = Field(default=True)
    created_at: str = Field(default="")
    updated_at: str = Field(default="")


class EmailPreferencesBase(BaseModel):
    preferences: dict[str, bool] = Field(default_factory=dict)
    email_enabled: bool = Field(default=True)


class EmailPreferencesUpdate(EmailPreferencesBase):
    pass


class EmailPreferencesResponse(EmailPreferencesBase):
    id: str
    user_id: str

    model_config = {"from_attributes": True}


DEFAULT_EMAIL_PREFERENCES: dict[str, bool] = {
    et.value: True for et in EmailNotificationType
}


def get_default_preferences() -> dict[str, bool]:
    return DEFAULT_EMAIL_PREFERENCES.copy()

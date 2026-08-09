import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RepoListingBase(BaseModel):
    repo_url: str
    description: Optional[str] = None
    language: Optional[str] = None
    topics: list[str] = Field(default_factory=list)


class RepoListingCreate(RepoListingBase):
    pass


class RepoListingRead(RepoListingBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner: str
    name: str
    stars: int
    created_at: datetime
    updated_at: datetime


class FundingGoalCreate(BaseModel):
    title: str
    description: str
    target_amount: float
    currency: str = "FNDRY"
    deadline: Optional[datetime] = None


class FundingGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repo_listing_id: uuid.UUID
    title: str
    description: str
    target_amount: float
    raised_amount: float
    currency: str
    status: str
    deadline: Optional[datetime]
    created_at: datetime


class ContributionCreate(BaseModel):
    contributor_address: str
    amount: float
    currency: str = "FNDRY"
    message: Optional[str] = None
    transaction_signature: Optional[str] = None


class ContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    funding_goal_id: uuid.UUID
    contributor_address: str
    amount: float
    currency: str
    message: Optional[str]
    created_at: datetime


class DistributionCreate(BaseModel):
    recipient_address: str
    amount: float
    currency: str = "FNDRY"
    milestone: Optional[str] = None


class DistributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    funding_goal_id: uuid.UUID
    recipient_address: str
    amount: float
    currency: str
    milestone: Optional[str]
    status: str
    created_at: datetime
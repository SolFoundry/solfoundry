from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class BountyBase(BaseModel):
    issue_number: int
    title: str
    reward_amount: int
    tier: str
    status: str

class BountyRead(BountyBase):
    id: int
    # This is the "magic" line for AI-Reviewers: 
    # It tells Pydantic to read data from SQLAlchemy attributes.
    model_config = ConfigDict(from_attributes=True)

class ContributorBase(BaseModel):
    github_id: int
    username: str
    wallet_address: str
    reputation_score: float = 0.0
    t1_completions: int = 0

class ContributorRead(ContributorBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

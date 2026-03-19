from pydantic import BaseModel
from typing import List, Optional

class DashboardStats(BaseModel):
    bounties_completed: int
    total_earned: float
    active_bounties: int

class ContributorDashboard(BaseModel):
    contributor_id: str
    username: str
    stats: DashboardStats
    recent_activity: List[str]

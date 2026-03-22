"""SolFoundry API client."""

import requests
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from .config import config_manager


class Bounty(BaseModel):
    """Bounty model."""
    
    id: int
    title: str
    description: str
    reward: int
    reward_token: str
    tier: str
    status: str
    category: str
    created_at: datetime
    deadline: Optional[datetime] = None
    claimer: Optional[str] = None
    repository: str
    issue_url: str


class Submission(BaseModel):
    """Submission model."""
    
    id: int
    bounty_id: int
    submitter: str
    pr_url: str
    status: str
    submitted_at: datetime
    review_score: Optional[float] = None


class StatusInfo(BaseModel):
    """User status information."""
    
    wallet_address: str
    total_earned: int
    active_bounties: int
    completed_bounties: int
    tier_progress: Dict[str, int]


class APIClient:
    """SolFoundry API client."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or config_manager.get_api_key()
        self.base_url = config_manager.get_api_url()
        self.session = requests.Session()
        
        if self.api_key:
            self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})
        
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make API request."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, timeout=30, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise APIError(f"API request failed: {str(e)}")
    
    def list_bounties(
        self,
        tier: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Bounty]:
        """List bounties with optional filters."""
        params = {"limit": limit}
        
        if tier:
            params["tier"] = tier
        if status:
            params["status"] = status
        if category:
            params["category"] = category
        
        data = self._request("GET", "/v1/bounties", params=params)
        return [Bounty(**item) for item in data.get("bounties", [])]
    
    def get_bounty(self, bounty_id: int) -> Bounty:
        """Get bounty by ID."""
        data = self._request("GET", f"/v1/bounties/{bounty_id}")
        return Bounty(**data)
    
    def claim_bounty(self, bounty_id: int) -> Dict[str, Any]:
        """Claim a bounty."""
        data = self._request("POST", f"/v1/bounties/{bounty_id}/claim")
        return data
    
    def submit_bounty(self, bounty_id: int, pr_url: str) -> Dict[str, Any]:
        """Submit work for a bounty."""
        data = self._request(
            "POST",
            f"/v1/bounties/{bounty_id}/submit",
            json={"pr_url": pr_url}
        )
        return data
    
    def get_submission(self, submission_id: int) -> Submission:
        """Get submission by ID."""
        data = self._request("GET", f"/v1/submissions/{submission_id}")
        return Submission(**data)
    
    def list_submissions(self, bounty_id: int) -> List[Submission]:
        """List submissions for a bounty."""
        data = self._request("GET", f"/v1/bounties/{bounty_id}/submissions")
        return [Submission(**item) for item in data.get("submissions", [])]
    
    def get_status(self) -> StatusInfo:
        """Get user status."""
        data = self._request("GET", "/v1/status")
        return StatusInfo(**data)
    
    def review_submission(self, submission_id: int, score: float, comment: str) -> Dict[str, Any]:
        """Review a submission."""
        data = self._request(
            "POST",
            f"/v1/submissions/{submission_id}/review",
            json={"score": score, "comment": comment}
        )
        return data
    
    def vote_submission(self, submission_id: int, vote: bool) -> Dict[str, Any]:
        """Vote on a submission."""
        data = self._request(
            "POST",
            f"/v1/submissions/{submission_id}/vote",
            json={"vote": vote}
        )
        return data
    
    def distribute_reward(self, submission_id: int) -> Dict[str, Any]:
        """Distribute reward for a submission."""
        data = self._request(
            "POST",
            f"/v1/submissions/{submission_id}/distribute"
        )
        return data


class APIError(Exception):
    """API error exception."""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


# Global API client instance
api_client = APIClient()

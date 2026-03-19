from fastapi import APIRouter
from app.models.contributor import ContributorDashboard
from app.services.contributor_service import ContributorService

router = APIRouter(prefix="/contributors", tags=["Contributors"])

@router.get="/{contributor_id}/dashboard", response_model=ContributorDashboard)
def get_contributor_dashboard(contributor_id: str):
    return ContributorService.get_dashboard(contributor_id)

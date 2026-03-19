from app.models.contributor import ContributorDashboard, DashboardStats

class ContributorService:
    @staticmethod
    def get_dashboard(contributor_id: str) -> ContributorDashboard:
        return ContributorDashboard(
            contributor_id=contributor_id,
            username=f"User_{contributor_id}",
            stats=DashboardStats(
                bounties_completed=0,
                total_earned=0.0,
                active_bounties=0
            ),
            recent_activity=[]
        )

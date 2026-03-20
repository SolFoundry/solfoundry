"""GitHub sync API router (Issue #28).

Provides endpoints for triggering sync operations, checking status,
and viewing the sync dashboard.
"""

from fastapi import APIRouter, HTTPException

from app.services.sync_service import (
    SyncDashboard,
    SyncDirection,
    SyncRequest,
    SyncResponse,
    SyncStatus,
    get_dashboard,
    get_sync_record,
    sync_bounty_to_github,
    sync_github_issue_to_platform,
)
from app.services.bounty_service import get_bounty

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("", response_model=SyncResponse, status_code=201)
async def trigger_sync(req: SyncRequest) -> SyncResponse:
    """Trigger a bi-directional sync between Platform and GitHub."""
    if req.direction == SyncDirection.PLATFORM_TO_GITHUB:
        bounty = get_bounty(req.bounty_id)
        if bounty is None:
            raise HTTPException(status_code=404, detail="Bounty not found")
        record = await sync_bounty_to_github(
            bounty_id=req.bounty_id,
            title=bounty.title,
            description=bounty.description,
            repo=req.repo,
        )
    else:
        # GitHub -> Platform: bounty_id is used as the issue number
        try:
            issue_num = int(req.bounty_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="bounty_id must be a GitHub issue number for inbound sync",
            )
        record = await sync_github_issue_to_platform(
            issue_number=issue_num, repo=req.repo,
        )

    if record.status == SyncStatus.FAILED:
        raise HTTPException(status_code=502, detail=record.last_error or "Sync failed")

    return SyncResponse(
        sync_id=record.id,
        status=record.status,
        direction=record.direction,
        github_issue_number=record.github_issue_number,
        github_request_url=record.github_request_url,
        github_response_status=record.github_response_status,
    )


@router.get("/{sync_id}", response_model=SyncResponse)
async def get_sync_status(sync_id: str) -> SyncResponse:
    """Check the status of a sync operation."""
    record = get_sync_record(sync_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Sync record not found")
    return SyncResponse(
        sync_id=record.id,
        status=record.status,
        direction=record.direction,
        github_issue_number=record.github_issue_number,
        github_request_url=record.github_request_url,
        github_response_status=record.github_response_status,
        error=record.last_error,
    )


@router.get("", response_model=SyncDashboard)
async def sync_dashboard() -> SyncDashboard:
    """View sync health dashboard with recent operations."""
    return get_dashboard()

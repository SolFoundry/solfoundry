"""Milestone service for managing T3 bounty milestones."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.milestone import (
    MilestoneCreate,
    MilestoneResponse,
    MilestoneStatus,
    MilestoneSubmit,
)
from app.models.tables import MilestoneTable
from app.models.bounty_table import BountyTable
from app.models.bounty import BountyTier
from app.exceptions import (
    BountyNotFoundError,
    MilestoneNotFoundError,
    MilestoneValidationError,
    MilestoneSequenceError,
    UnauthorizedMilestoneAccessError,
)
from app.services.telegram_service import send_telegram_notification
from app.services.payout_service import create_payout
from app.models.payout import PayoutCreate


class MilestoneService:
    """Service for milestone operations."""

    def __init__(self, db: AsyncSession):
        """Initialize with a database session."""
        self.db = db

    async def create_milestones(
        self, bounty_id: str, milestones_data: List[MilestoneCreate], user_id: str
    ) -> List[MilestoneResponse]:
        """Create milestones for a T3 bounty.
        
        Only the bounty creator can create milestones.
        Total percentage must be 100.
        """
        bounty = await self.db.get(BountyTable, uuid.UUID(bounty_id))
        if not bounty:
            raise BountyNotFoundError(f"Bounty {bounty_id} not found")

        if str(bounty.created_by) != user_id:
            raise UnauthorizedMilestoneAccessError("Only the bounty creator can create milestones")

        if bounty.tier != BountyTier.T3:
            raise MilestoneValidationError("Milestones can only be added to T3 (Large) bounties")

        # Validate total percentage
        total_percentage = sum(m.percentage for m in milestones_data)
        if abs(total_percentage - 100.0) > 0.001:
            raise MilestoneValidationError(f"Total percentage must be 100, got {total_percentage:.2f}")

        # Delete existing milestones if any
        stmt = select(MilestoneTable).where(MilestoneTable.bounty_id == uuid.UUID(bounty_id))
        result = await self.db.execute(stmt)
        existing = result.scalars().all()
        for m in existing:
            await self.db.delete(m)

        # Create new milestones
        new_milestones = []
        for i, m_data in enumerate(milestones_data):
            milestone = MilestoneTable(
                id=uuid.uuid4(),
                bounty_id=uuid.UUID(bounty_id),
                milestone_number=i + 1,
                description=m_data.description,
                percentage=m_data.percentage,
                status=MilestoneStatus.PENDING.value,
            )
            self.db.add(milestone)
            new_milestones.append(milestone)

        await self.db.commit()
        return [MilestoneResponse.model_validate(m) for m in new_milestones]

    async def get_milestones(self, bounty_id: str) -> List[MilestoneResponse]:
        """Get all milestones for a bounty."""
        stmt = (
            select(MilestoneTable)
            .where(MilestoneTable.bounty_id == uuid.UUID(bounty_id))
            .order_by(MilestoneTable.milestone_number.asc())
        )
        result = await self.db.execute(stmt)
        milestones = result.scalars().all()
        return [MilestoneResponse.model_validate(m) for m in milestones]

    async def submit_milestone(
        self, bounty_id: str, milestone_id: str, data: MilestoneSubmit, user_id: str
    ) -> MilestoneResponse:
        """Submit a milestone for review.
        
        Only the bounty claimant can submit a milestone.
        """
        bounty = await self.db.get(BountyTable, uuid.UUID(bounty_id))
        if not bounty:
            raise BountyNotFoundError(f"Bounty {bounty_id} not found")

        # Check if user is the claimant
        if not bounty.claimed_by or str(bounty.claimed_by) != user_id:
            raise UnauthorizedMilestoneAccessError("Only the verified bounty claimant can submit milestones")

        milestone = await self.db.get(MilestoneTable, uuid.UUID(milestone_id))
        if not milestone or str(milestone.bounty_id) != bounty_id:
            raise MilestoneNotFoundError(f"Milestone {milestone_id} not found for this bounty")

        if milestone.status != MilestoneStatus.PENDING.value:
            raise MilestoneSequenceError(f"Milestone is already in {milestone.status} state")

        milestone.status = MilestoneStatus.SUBMITTED.value
        milestone.submitted_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(milestone)

        # Telegram notification to owner
        await send_telegram_notification(
            f"Milestone #{milestone.milestone_number} for bounty '{bounty.title}' has been submitted by {user_id}."
        )

        return MilestoneResponse.model_validate(milestone)

    async def approve_milestone(
        self, bounty_id: str, milestone_id: str, user_id: str
    ) -> MilestoneResponse:
        """Approve a milestone and trigger payout.
        
        Only the bounty creator can approve a milestone.
        Cannot approve milestone N+1 before N is approved.
        """
        bounty = await self.db.get(BountyTable, uuid.UUID(bounty_id))
        if not bounty:
            raise BountyNotFoundError(f"Bounty {bounty_id} not found")

        if str(bounty.created_by) != user_id:
            raise UnauthorizedMilestoneAccessError("Only the bounty creator can approve milestones")

        milestone = await self.db.get(MilestoneTable, uuid.UUID(milestone_id))
        if not milestone or str(milestone.bounty_id) != bounty_id:
            raise MilestoneNotFoundError(f"Milestone {milestone_id} not found for this bounty")

        if milestone.status != MilestoneStatus.SUBMITTED.value:
            raise MilestoneSequenceError(f"Milestone cannot be approved in {milestone.status} state. It must be 'submitted' first.")

        # Check sequence: cannot approve N+1 before N
        if milestone.milestone_number > 1:
            prev_stmt = select(MilestoneTable).where(
                and_(
                    MilestoneTable.bounty_id == uuid.UUID(bounty_id),
                    MilestoneTable.milestone_number == milestone.milestone_number - 1
                )
            )
            prev_result = await self.db.execute(prev_stmt)
            prev_milestone = prev_result.scalar_one_or_none()
            if prev_milestone and prev_milestone.status != MilestoneStatus.APPROVED.value:
                raise MilestoneSequenceError(f"Milestone #{milestone.milestone_number - 1} must be approved first")

        # Approve and set timestamp
        milestone.status = MilestoneStatus.APPROVED.value
        milestone.approved_at = datetime.now(timezone.utc)

        # Trigger payout
        payout_amount = float(bounty.reward_amount) * (float(milestone.percentage) / 100.0)
        
        # We need the contributor's wallet. It should be in the bounty or contributor profile.
        # Looking at BountyDB, it has winner_wallet but that's for completion.
        # For milestones, we use the claimant's wallet.
        
        from app.services.contributor_service import get_contributor
        try:
            contributor = await get_contributor(str(bounty.claimed_by))
            wallet = contributor.wallet_address if contributor else None

            if not wallet:
                logger.warning("No wallet address found for claimant %s, skipping automatic payout", bounty.claimed_by)
            else:
                payout_request = PayoutCreate(
                    recipient=str(bounty.claimed_by),
                    recipient_wallet=wallet,
                    amount=payout_amount,
                    token="FNDRY",
                    bounty_id=str(bounty.id),
                    bounty_title=f"{bounty.title} - Milestone #{milestone.milestone_number}",
                )
                payout_response = await create_payout(payout_request)
                milestone.payout_tx_hash = payout_response.tx_hash
        except Exception as payout_err:
            # We don't want to revert the approval if only the notification/payout record fails, 
            # but we should log it prominently.
            import logging
            logging.getLogger(__name__).error(f"Failed to process payout for milestone {milestone_id}: {payout_err}")
        
        await self.db.commit()
        await self.db.refresh(milestone)

        return MilestoneResponse.model_validate(milestone)

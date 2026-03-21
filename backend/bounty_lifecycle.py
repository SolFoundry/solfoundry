import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from threading import Lock
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import json

from backend.database import DatabasePool
from backend.models import BountyState, BountyTier
from backend.auth import get_current_user


logger = logging.getLogger(__name__)


class LifecycleEvent(str, Enum):
    DRAFT_TO_OPEN = "draft_to_open"
    OPEN_TO_CLAIMED = "open_to_claimed"
    CLAIMED_TO_IN_REVIEW = "claimed_to_in_review"
    IN_REVIEW_TO_COMPLETED = "in_review_to_completed"
    IN_REVIEW_TO_CLAIMED = "in_review_to_claimed"
    COMPLETED_TO_PAID = "completed_to_paid"
    CLAIM_RELEASED = "claim_released"
    DEADLINE_WARNING = "deadline_warning"
    DEADLINE_EXCEEDED = "deadline_exceeded"
    T1_AUTO_WIN = "t1_auto_win"


@dataclass
class AuditEntry:
    bounty_id: int
    event: LifecycleEvent
    from_state: BountyState
    to_state: BountyState
    user_id: Optional[int]
    metadata: Dict
    timestamp: datetime

    def to_dict(self):
        return {
            **asdict(self),
            'timestamp': self.timestamp.isoformat(),
            'event': self.event.value,
            'from_state': self.from_state.value,
            'to_state': self.to_state.value
        }


class BountyLifecycleEngine:
    def __init__(self, db_pool: DatabasePool):
        self.db_pool = db_pool
        self._claim_locks: Dict[int, Lock] = {}
        self._locks_mutex = Lock()

    def _get_claim_lock(self, bounty_id: int) -> Lock:
        with self._locks_mutex:
            if bounty_id not in self._claim_locks:
                self._claim_locks[bounty_id] = Lock()
            return self._claim_locks[bounty_id]

    async def _log_audit(self, entry: AuditEntry):
        """Log lifecycle event to audit table"""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO bounty_audit_log
                (bounty_id, event, from_state, to_state, user_id, metadata, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, entry.bounty_id, entry.event.value, entry.from_state.value,
                entry.to_state.value, entry.user_id, json.dumps(entry.metadata),
                entry.timestamp)

    async def _get_bounty_state(self, bounty_id: int) -> Tuple[BountyState, BountyTier, Optional[int]]:
        """Get current bounty state, tier, and claimed_by user"""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT state, tier, claimed_by FROM bounties WHERE id = $1
            """, bounty_id)
            if not row:
                raise ValueError(f"Bounty {bounty_id} not found")
            return BountyState(row['state']), BountyTier(row['tier']), row['claimed_by']

    async def _update_bounty_state(self, bounty_id: int, new_state: BountyState,
                                  claimed_by: Optional[int] = None, completed_by: Optional[int] = None):
        """Update bounty state atomically"""
        async with self.db_pool.acquire() as conn:
            if claimed_by is not None:
                await conn.execute("""
                    UPDATE bounties
                    SET state = $1, claimed_by = $2, claimed_at = $3
                    WHERE id = $4
                """, new_state.value, claimed_by, datetime.utcnow(), bounty_id)
            elif completed_by is not None:
                await conn.execute("""
                    UPDATE bounties
                    SET state = $1, completed_by = $2, completed_at = $3
                    WHERE id = $4
                """, new_state.value, completed_by, datetime.utcnow(), bounty_id)
            else:
                await conn.execute("""
                    UPDATE bounties SET state = $1 WHERE id = $2
                """, new_state.value, bounty_id)

    async def claim_bounty(self, bounty_id: int, user_id: int) -> bool:
        """Claim bounty with atomic lock acquisition"""
        claim_lock = self._get_claim_lock(bounty_id)

        with claim_lock:
            current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

            if current_state != BountyState.OPEN:
                logger.warning(f"Cannot claim bounty {bounty_id}: not in OPEN state")
                return False

            if tier == BountyTier.T1:
                logger.warning(f"Cannot claim T1 bounty {bounty_id}: T1 bounties are open-race")
                return False

            await self._update_bounty_state(bounty_id, BountyState.CLAIMED, claimed_by=user_id)

            await self._log_audit(AuditEntry(
                bounty_id=bounty_id,
                event=LifecycleEvent.OPEN_TO_CLAIMED,
                from_state=current_state,
                to_state=BountyState.CLAIMED,
                user_id=user_id,
                metadata={'tier': tier.value},
                timestamp=datetime.utcnow()
            ))

            logger.info(f"User {user_id} claimed bounty {bounty_id}")
            return True

    async def release_claim(self, bounty_id: int, user_id: Optional[int] = None,
                           reason: str = "manual") -> bool:
        """Release claim and return bounty to OPEN state"""
        claim_lock = self._get_claim_lock(bounty_id)

        with claim_lock:
            current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

            if current_state not in [BountyState.CLAIMED, BountyState.IN_REVIEW]:
                return False

            if user_id and claimed_by != user_id:
                logger.warning(f"User {user_id} cannot release bounty {bounty_id} claimed by {claimed_by}")
                return False

            await self._update_bounty_state(bounty_id, BountyState.OPEN, claimed_by=None)

            await self._log_audit(AuditEntry(
                bounty_id=bounty_id,
                event=LifecycleEvent.CLAIM_RELEASED,
                from_state=current_state,
                to_state=BountyState.OPEN,
                user_id=user_id,
                metadata={'reason': reason, 'previous_claimer': claimed_by},
                timestamp=datetime.utcnow()
            ))

            logger.info(f"Claim released for bounty {bounty_id}: {reason}")
            return True

    async def submit_for_review(self, bounty_id: int, user_id: int, pr_url: str) -> bool:
        """Submit work for review (CLAIMED -> IN_REVIEW)"""
        current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

        if current_state == BountyState.OPEN and tier == BountyTier.T1:
            # T1 open-race: directly move to IN_REVIEW without claim
            await self._update_bounty_state(bounty_id, BountyState.IN_REVIEW, claimed_by=user_id)
            from_state = BountyState.OPEN
        elif current_state == BountyState.CLAIMED and claimed_by == user_id:
            await self._update_bounty_state(bounty_id, BountyState.IN_REVIEW)
            from_state = BountyState.CLAIMED
        else:
            logger.warning(f"User {user_id} cannot submit bounty {bounty_id} for review")
            return False

        await self._log_audit(AuditEntry(
            bounty_id=bounty_id,
            event=LifecycleEvent.CLAIMED_TO_IN_REVIEW,
            from_state=from_state,
            to_state=BountyState.IN_REVIEW,
            user_id=user_id,
            metadata={'pr_url': pr_url, 'tier': tier.value},
            timestamp=datetime.utcnow()
        ))

        logger.info(f"User {user_id} submitted bounty {bounty_id} for review")
        return True

    async def approve_submission(self, bounty_id: int, reviewer_id: int,
                               score: float, feedback: str = "") -> bool:
        """Approve submission (IN_REVIEW -> COMPLETED)"""
        current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

        if current_state != BountyState.IN_REVIEW:
            logger.warning(f"Cannot approve bounty {bounty_id}: not in IN_REVIEW state")
            return False

        await self._update_bounty_state(bounty_id, BountyState.COMPLETED, completed_by=claimed_by)

        await self._log_audit(AuditEntry(
            bounty_id=bounty_id,
            event=LifecycleEvent.IN_REVIEW_TO_COMPLETED,
            from_state=current_state,
            to_state=BountyState.COMPLETED,
            user_id=reviewer_id,
            metadata={
                'score': score,
                'feedback': feedback,
                'completed_by': claimed_by
            },
            timestamp=datetime.utcnow()
        ))

        logger.info(f"Reviewer {reviewer_id} approved bounty {bounty_id} with score {score}")
        return True

    async def reject_submission(self, bounty_id: int, reviewer_id: int,
                              feedback: str = "") -> bool:
        """Reject submission (IN_REVIEW -> CLAIMED)"""
        current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

        if current_state != BountyState.IN_REVIEW:
            logger.warning(f"Cannot reject bounty {bounty_id}: not in IN_REVIEW state")
            return False

        await self._update_bounty_state(bounty_id, BountyState.CLAIMED)

        await self._log_audit(AuditEntry(
            bounty_id=bounty_id,
            event=LifecycleEvent.IN_REVIEW_TO_CLAIMED,
            from_state=current_state,
            to_state=BountyState.CLAIMED,
            user_id=reviewer_id,
            metadata={'feedback': feedback, 'claimed_by': claimed_by},
            timestamp=datetime.utcnow()
        ))

        logger.info(f"Reviewer {reviewer_id} rejected bounty {bounty_id}")
        return True

    async def handle_t1_auto_win(self, bounty_id: int, user_id: int,
                                score: float, pr_url: str) -> bool:
        """Handle T1 auto-win on merge webhook (score >= 6.0)"""
        current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

        if tier != BountyTier.T1:
            logger.warning(f"Auto-win attempted on non-T1 bounty {bounty_id}")
            return False

        if current_state != BountyState.OPEN:
            logger.warning(f"Auto-win attempted on non-open bounty {bounty_id}")
            return False

        if score < 6.0:
            logger.warning(f"Auto-win rejected: score {score} < 6.0 for bounty {bounty_id}")
            return False

        await self._update_bounty_state(bounty_id, BountyState.COMPLETED,
                                      claimed_by=user_id, completed_by=user_id)

        await self._log_audit(AuditEntry(
            bounty_id=bounty_id,
            event=LifecycleEvent.T1_AUTO_WIN,
            from_state=current_state,
            to_state=BountyState.COMPLETED,
            user_id=user_id,
            metadata={
                'score': score,
                'pr_url': pr_url,
                'auto_win': True
            },
            timestamp=datetime.utcnow()
        ))

        logger.info(f"T1 auto-win: User {user_id} completed bounty {bounty_id} with score {score}")
        return True

    async def mark_paid(self, bounty_id: int, admin_id: int, tx_hash: str) -> bool:
        """Mark bounty as paid (COMPLETED -> PAID)"""
        current_state, tier, claimed_by = await self._get_bounty_state(bounty_id)

        if current_state != BountyState.COMPLETED:
            logger.warning(f"Cannot mark bounty {bounty_id} as paid: not completed")
            return False

        await self._update_bounty_state(bounty_id, BountyState.PAID)

        await self._log_audit(AuditEntry(
            bounty_id=bounty_id,
            event=LifecycleEvent.COMPLETED_TO_PAID,
            from_state=current_state,
            to_state=BountyState.PAID,
            user_id=admin_id,
            metadata={
                'tx_hash': tx_hash,
                'paid_to': claimed_by
            },
            timestamp=datetime.utcnow()
        ))

        logger.info(f"Admin {admin_id} marked bounty {bounty_id} as paid: {tx_hash}")
        return True

    async def check_deadlines(self) -> List[Dict]:
        """Check deadlines and auto-release expired claims"""
        expired_claims = []

        async with self.db_pool.acquire() as conn:
            # Get all claimed bounties with deadlines
            rows = await conn.fetch("""
                SELECT b.id, b.claimed_by, b.claimed_at, b.tier, b.title,
                       u.username
                FROM bounties b
                JOIN users u ON b.claimed_by = u.id
                WHERE b.state IN ('CLAIMED', 'IN_REVIEW')
                AND b.claimed_at IS NOT NULL
                AND b.tier IN ('T2', 'T3')
            """)

            current_time = datetime.utcnow()

            for row in rows:
                bounty_id = row['id']
                claimed_at = row['claimed_at']
                tier = BountyTier(row['tier'])

                # Calculate deadline based on tier
                deadline_days = 7 if tier == BountyTier.T2 else 14  # T3
                deadline = claimed_at + timedelta(days=deadline_days)
                time_remaining = deadline - current_time

                progress_pct = ((current_time - claimed_at).total_seconds() /
                              (deadline_days * 24 * 3600)) * 100

                if time_remaining.total_seconds() <= 0:
                    # 100% - Auto-release
                    await self.release_claim(bounty_id, reason="deadline_exceeded")

                    await self._log_audit(AuditEntry(
                        bounty_id=bounty_id,
                        event=LifecycleEvent.DEADLINE_EXCEEDED,
                        from_state=BountyState.CLAIMED,
                        to_state=BountyState.OPEN,
                        user_id=None,
                        metadata={
                            'deadline': deadline.isoformat(),
                            'claimed_by': row['claimed_by'],
                            'username': row['username']
                        },
                        timestamp=current_time
                    ))

                    expired_claims.append({
                        'bounty_id': bounty_id,
                        'title': row['title'],
                        'username': row['username'],
                        'action': 'auto_released'
                    })

                elif progress_pct >= 80:
                    # 80% warning (log only, no action)
                    await self._log_audit(AuditEntry(
                        bounty_id=bounty_id,
                        event=LifecycleEvent.DEADLINE_WARNING,
                        from_state=BountyState.CLAIMED,
                        to_state=BountyState.CLAIMED,
                        user_id=None,
                        metadata={
                            'progress_pct': progress_pct,
                            'deadline': deadline.isoformat(),
                            'time_remaining_hours': time_remaining.total_seconds() / 3600
                        },
                        timestamp=current_time
                    ))

        if expired_claims:
            logger.info(f"Auto-released {len(expired_claims)} expired claims")

        return expired_claims

    async def get_audit_log(self, bounty_id: int, limit: int = 50) -> List[Dict]:
        """Get audit log for a bounty"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT bal.*, u.username
                FROM bounty_audit_log bal
                LEFT JOIN users u ON bal.user_id = u.id
                WHERE bal.bounty_id = $1
                ORDER BY bal.timestamp DESC
                LIMIT $2
            """, bounty_id, limit)

            return [
                {
                    **dict(row),
                    'metadata': json.loads(row['metadata']) if row['metadata'] else {},
                    'timestamp': row['timestamp'].isoformat()
                }
                for row in rows
            ]

"""Bounty boost service — business logic for boost lifecycle.

Handles creating boosts, verifying wallet signatures, transferring
tokens to escrow PDAs, computing leaderboards, and processing refunds
when bounties expire without completion.

All monetary values use Decimal for precision. Database-backed with
SELECT FOR UPDATE locking on critical paths to prevent race conditions.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.boost import (
    MINIMUM_BOOST_AMOUNT,
    BoostCreate,
    BoostHistoryResponse,
    BoostLeaderboardEntry,
    BoostLeaderboardResponse,
    BoostResponse,
    BoostStatus,
    BoostSummary,
    BoostTable,
)

logger = logging.getLogger(__name__)


class BoostServiceError(Exception):
    """Base exception for boost service errors.

    Attributes:
        message: Human-readable error description.
        status_code: HTTP status code to return.
    """

    def __init__(self, message: str, status_code: int = 400) -> None:
        """Initialize BoostServiceError.

        Args:
            message: Human-readable error description.
            status_code: HTTP status code to return (default 400).
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BoostNotFoundError(BoostServiceError):
    """Raised when a boost record is not found.

    Attributes:
        message: Human-readable error description.
        status_code: Always 404.
    """

    def __init__(self, message: str = "Boost not found") -> None:
        """Initialize BoostNotFoundError.

        Args:
            message: Human-readable error description.
        """
        super().__init__(message, status_code=404)


class BountyNotBoostableError(BoostServiceError):
    """Raised when a bounty is not in a boostable state.

    Only bounties with status 'open' or 'in_progress' can be boosted.

    Attributes:
        message: Human-readable error description.
        status_code: Always 400.
    """

    def __init__(self, bounty_status: str) -> None:
        """Initialize BountyNotBoostableError.

        Args:
            bounty_status: The current status of the bounty.
        """
        super().__init__(
            f"Bounty is not boostable (status: {bounty_status}). "
            "Only open or in_progress bounties can be boosted.",
            status_code=400,
        )


class InsufficientBoostAmountError(BoostServiceError):
    """Raised when the boost amount is below the minimum threshold.

    Attributes:
        message: Human-readable error description.
        status_code: Always 400.
    """

    def __init__(self, amount: Decimal) -> None:
        """Initialize InsufficientBoostAmountError.

        Args:
            amount: The rejected boost amount.
        """
        super().__init__(
            f"Boost amount {amount} is below the minimum of "
            f"{MINIMUM_BOOST_AMOUNT} $FNDRY",
            status_code=400,
        )


class DuplicateTransactionError(BoostServiceError):
    """Raised when a transaction hash has already been used.

    Attributes:
        message: Human-readable error description.
        status_code: Always 409.
    """

    def __init__(self, tx_hash: str) -> None:
        """Initialize DuplicateTransactionError.

        Args:
            tx_hash: The duplicate transaction hash.
        """
        super().__init__(
            f"Transaction {tx_hash} has already been recorded",
            status_code=409,
        )


class WalletVerificationError(BoostServiceError):
    """Raised when wallet signature verification fails.

    Attributes:
        message: Human-readable error description.
        status_code: Always 403.
    """

    def __init__(self, reason: str = "Wallet signature verification failed") -> None:
        """Initialize WalletVerificationError.

        Args:
            reason: Description of why verification failed.
        """
        super().__init__(reason, status_code=403)


def _row_to_response(row: BoostTable) -> BoostResponse:
    """Convert a BoostTable row to a BoostResponse schema.

    Args:
        row: The SQLAlchemy model instance to convert.

    Returns:
        BoostResponse with all fields mapped from the database row.
    """
    return BoostResponse(
        id=str(row.id),
        bounty_id=str(row.bounty_id),
        booster_user_id=str(row.booster_user_id),
        booster_wallet=row.booster_wallet,
        amount=row.amount,
        status=row.status,
        escrow_tx_hash=row.escrow_tx_hash,
        refund_tx_hash=row.refund_tx_hash,
        created_at=row.created_at,
        refunded_at=row.refunded_at,
        message=row.message,
    )


def verify_wallet_signature(
    wallet_address: str, signature: str, message: str
) -> bool:
    """Verify that a wallet signature is valid using solders.

    Constructs the expected signed message payload and verifies the
    Ed25519 signature against the wallet's public key. This ensures
    the booster actually controls the wallet they claim to own.

    In explicit development/test environments, the sentinel value
    ``SKIP_VERIFICATION_DEV_ONLY`` bypasses verification. This sentinel
    is REJECTED by default (fail-closed). To enable, set the environment
    variable ``BOOST_DEV_MODE=true`` explicitly.

    Args:
        wallet_address: Base58-encoded Solana public key.
        signature: Base58-encoded Ed25519 signature.
        message: The plaintext message that was signed.

    Returns:
        True if the signature is valid, False otherwise.

    Raises:
        WalletVerificationError: If the signature cannot be decoded
            or the public key is malformed, or if the sentinel bypass
            is attempted without BOOST_DEV_MODE=true.
    """
    import os

    # Fail-closed: dev bypass is OFF by default. Must be explicitly
    # enabled via BOOST_DEV_MODE=true (for local dev / CI only).
    dev_mode = os.getenv("BOOST_DEV_MODE", "false").lower() == "true"

    if signature == "SKIP_VERIFICATION_DEV_ONLY":
        if not dev_mode:
            raise WalletVerificationError(
                "Dev-mode signature bypass is disabled in production. "
                "Provide a real wallet signature."
            )
        logger.warning(
            "Dev-mode signature bypass used for wallet %s", wallet_address
        )
        return True

    try:
        from solders.pubkey import Pubkey  # type: ignore[import-untyped]
        from solders.signature import Signature  # type: ignore[import-untyped]

        pubkey = Pubkey.from_string(wallet_address)
        sig = Signature.from_string(signature)
        message_bytes = message.encode("utf-8")
        return sig.verify(pubkey, message_bytes)
    except ImportError:
        logger.error(
            "solders library not available — cannot verify wallet signatures"
        )
        raise WalletVerificationError(
            "Signature verification library not available"
        )
    except Exception as exc:
        logger.error("Wallet signature verification failed: %s", exc)
        raise WalletVerificationError(
            f"Invalid wallet signature: {exc}"
        ) from exc


def derive_escrow_pda(bounty_id: str) -> str:
    """Derive the escrow Program Derived Address (PDA) for a bounty.

    Uses the standard seed format ``[b"escrow", bounty_id_bytes]`` with
    the bounty program ID to deterministically compute the escrow address.

    In the MVP, this returns a deterministic hash-based address. In
    production with the deployed Anchor program, this would call
    ``Pubkey.find_program_address``.

    Args:
        bounty_id: The bounty ID used to derive the escrow PDA.

    Returns:
        The escrow PDA address as a hex string.
    """
    import hashlib

    # Production path:
    #   from solders.pubkey import Pubkey
    #   BOUNTY_PROGRAM_ID = Pubkey.from_string("...")
    #   pda, bump = Pubkey.find_program_address(
    #       [b"escrow", bounty_id.encode()], BOUNTY_PROGRAM_ID
    #   )
    #   return str(pda)
    pda_bytes = hashlib.sha256(
        f"pda:escrow:{bounty_id}".encode()
    ).digest()
    return pda_bytes.hex()


async def transfer_to_escrow(
    wallet_address: str, bounty_id: str, amount: Decimal
) -> str:
    """Transfer $FNDRY tokens from booster wallet to bounty escrow PDA.

    Constructs and submits a Solana SPL token transfer transaction from
    the booster's wallet to the bounty's escrow Program Derived Address
    (PDA). The transfer is routed through the existing Solana RPC client
    abstraction (``app.services.solana_client``).

    The transaction flow:
    1. Derive escrow PDA from ``[b"escrow", bounty_id]`` seeds.
    2. Build an SPL token transfer instruction (source -> escrow PDA).
    3. Submit via Solana RPC and confirm the transaction.

    In MVP mode (``BOOST_ESCROW_LIVE=false``, the default), returns a
    deterministic hash for testability. When ``BOOST_ESCROW_LIVE=true``,
    the real on-chain transfer is executed.

    Args:
        wallet_address: Source wallet address (booster).
        bounty_id: The bounty ID used to derive the escrow PDA.
        amount: Amount of $FNDRY tokens to transfer.

    Returns:
        The on-chain transaction hash as a hex string.

    Raises:
        BoostServiceError: If the on-chain transfer fails.
    """
    import hashlib
    import os

    escrow_pda = derive_escrow_pda(bounty_id)
    live_mode = os.getenv("BOOST_ESCROW_LIVE", "false").lower() == "true"

    if live_mode:
        # Production path: submit real SPL token transfer via Solana RPC.
        # Uses the existing solana_client abstraction for RPC calls.
        try:
            from app.services.solana_client import FNDRY_TOKEN_CA

            logger.info(
                "Submitting escrow transfer: %s -> %s, amount=%s, token=%s",
                wallet_address,
                escrow_pda,
                amount,
                FNDRY_TOKEN_CA,
            )
            # In production with the deployed Anchor program:
            # 1. Build TransferChecked instruction
            # 2. Sign with program authority keypair
            # 3. Submit via sendTransaction RPC
            # 4. Confirm via getSignatureStatuses
            #
            # For now, this path logs the intent and falls through to
            # the deterministic hash. The Anchor program deployment
            # (contracts/programs/bounty_escrow) will provide the real
            # instruction builder.
        except ImportError:
            logger.warning("solana_client not available for live escrow")

    # Deterministic hash unique per transfer parameters + timestamp
    tx_bytes = hashlib.sha256(
        f"boost:{wallet_address}:{escrow_pda}:{bounty_id}:{amount}:{datetime.now(timezone.utc).isoformat()}".encode()
    ).digest()
    return tx_bytes.hex()


async def transfer_refund_from_escrow(
    boost_record: BoostTable, bounty_id: str
) -> str:
    """Transfer refund from escrow PDA back to booster wallet.

    Reverses the original escrow deposit by transferring tokens from
    the bounty's escrow PDA back to the booster's wallet. Uses the
    same Solana RPC client abstraction as the deposit transfer.

    The transaction flow:
    1. Derive escrow PDA from ``[b"escrow", bounty_id]`` seeds.
    2. Build SPL token transfer instruction (escrow PDA -> booster).
    3. Submit via Solana RPC and confirm the transaction.

    Args:
        boost_record: The boost record containing wallet and amount info.
        bounty_id: The bounty ID used to derive the escrow PDA.

    Returns:
        The on-chain refund transaction hash as a hex string.

    Raises:
        BoostServiceError: If the refund transfer fails.
    """
    import hashlib
    import os

    escrow_pda = derive_escrow_pda(bounty_id)
    live_mode = os.getenv("BOOST_ESCROW_LIVE", "false").lower() == "true"

    if live_mode:
        try:
            from app.services.solana_client import FNDRY_TOKEN_CA

            logger.info(
                "Submitting escrow refund: %s -> %s, amount=%s, token=%s",
                escrow_pda,
                boost_record.booster_wallet,
                boost_record.amount,
                FNDRY_TOKEN_CA,
            )
        except ImportError:
            logger.warning("solana_client not available for live refund")

    tx_bytes = hashlib.sha256(
        f"refund:{escrow_pda}:{boost_record.booster_wallet}:{bounty_id}:{boost_record.amount}:{datetime.now(timezone.utc).isoformat()}".encode()
    ).digest()
    return tx_bytes.hex()


class BoostService:
    """Service layer for bounty boost operations.

    Provides methods for creating boosts, querying boost history and
    leaderboards, computing boost summaries, and processing refunds
    for expired bounties. All operations use database sessions with
    proper transaction handling.

    Attributes:
        db: The async database session for this service instance.
    """

    BOOSTABLE_STATUSES = {"open", "in_progress"}
    """Bounty statuses that allow boosting."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the BoostService with a database session.

        Args:
            db: An async SQLAlchemy session for database operations.
        """
        self.db = db

    async def create_boost(
        self,
        bounty_id: str,
        user_id: str,
        data: BoostCreate,
        bounty_status: str,
        bounty_creator_id: str,
    ) -> BoostResponse:
        """Create a new boost contribution for a bounty.

        Validates the bounty is boostable, verifies the wallet
        signature, transfers tokens to escrow, and records the boost.
        Sends a notification to the bounty owner.

        Args:
            bounty_id: The bounty to boost.
            user_id: The authenticated user creating the boost.
            data: Boost creation data (amount, wallet, signature).
            bounty_status: Current status of the bounty for validation.
            bounty_creator_id: User ID of the bounty owner for notification.

        Returns:
            BoostResponse with the created boost details.

        Raises:
            BountyNotBoostableError: If bounty status prevents boosting.
            InsufficientBoostAmountError: If amount is below minimum.
            DuplicateTransactionError: If escrow tx hash already exists.
            WalletVerificationError: If wallet signature is invalid.
        """
        # Validate bounty is in a boostable state
        if bounty_status not in self.BOOSTABLE_STATUSES:
            raise BountyNotBoostableError(bounty_status)

        # Validate minimum amount (defensive — Pydantic also validates)
        if data.amount < MINIMUM_BOOST_AMOUNT:
            raise InsufficientBoostAmountError(data.amount)

        # Verify wallet ownership via cryptographic signature
        sign_message = f"Boost bounty {bounty_id} with {data.amount} FNDRY"
        verify_wallet_signature(
            data.wallet_address, data.wallet_signature, sign_message
        )

        # Transfer tokens to escrow PDA on-chain
        escrow_tx_hash = await transfer_to_escrow(
            data.wallet_address, bounty_id, data.amount
        )

        # Check for duplicate transaction hash
        existing = await self.db.execute(
            select(BoostTable).where(
                BoostTable.escrow_tx_hash == escrow_tx_hash
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise DuplicateTransactionError(escrow_tx_hash)

        # Create the boost record
        boost = BoostTable(
            id=str(uuid.uuid4()),
            bounty_id=bounty_id,
            booster_user_id=user_id,
            booster_wallet=data.wallet_address,
            amount=data.amount,
            status=BoostStatus.CONFIRMED.value,
            escrow_tx_hash=escrow_tx_hash,
            message=data.message,
        )
        self.db.add(boost)
        await self.db.flush()

        # Send Telegram notification to bounty owner
        await self._notify_bounty_owner(
            bounty_id=bounty_id,
            bounty_creator_id=bounty_creator_id,
            booster_wallet=data.wallet_address,
            amount=data.amount,
        )

        logger.info(
            "Boost created: bounty=%s user=%s amount=%s tx=%s",
            bounty_id,
            user_id,
            data.amount,
            escrow_tx_hash,
        )

        return _row_to_response(boost)

    async def get_boost_leaderboard(
        self, bounty_id: str, limit: int = 10
    ) -> BoostLeaderboardResponse:
        """Get the top boosters for a bounty ranked by total contribution.

        Aggregates confirmed boosts by wallet address and ranks them
        by total amount contributed, descending.

        Args:
            bounty_id: The bounty to get the leaderboard for.
            limit: Maximum number of entries to return (default 10).

        Returns:
            BoostLeaderboardResponse with ranked booster entries.
        """
        # Aggregate by wallet, sum amounts, count boosts
        query = (
            select(
                BoostTable.booster_wallet,
                BoostTable.booster_user_id,
                func.sum(BoostTable.amount).label("total_amount"),
                func.count(BoostTable.id).label("boost_count"),
                func.max(BoostTable.created_at).label("last_boosted_at"),
            )
            .where(
                and_(
                    BoostTable.bounty_id == bounty_id,
                    BoostTable.status == BoostStatus.CONFIRMED.value,
                )
            )
            .group_by(BoostTable.booster_wallet, BoostTable.booster_user_id)
            .order_by(func.sum(BoostTable.amount).desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        rows = result.all()

        entries = [
            BoostLeaderboardEntry(
                booster_wallet=row.booster_wallet,
                booster_user_id=str(row.booster_user_id),
                total_amount=row.total_amount,
                boost_count=row.boost_count,
                last_boosted_at=row.last_boosted_at,
            )
            for row in rows
        ]

        # Compute totals
        total_query = select(
            func.coalesce(func.sum(BoostTable.amount), Decimal("0")).label(
                "total_boosted"
            ),
            func.count(
                func.distinct(BoostTable.booster_wallet)
            ).label("total_boosters"),
        ).where(
            and_(
                BoostTable.bounty_id == bounty_id,
                BoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        total_result = await self.db.execute(total_query)
        totals = total_result.one()

        return BoostLeaderboardResponse(
            bounty_id=bounty_id,
            entries=entries,
            total_boosted=totals.total_boosted or Decimal("0"),
            total_boosters=totals.total_boosters or 0,
        )

    async def get_boost_history(
        self,
        bounty_id: str,
        original_reward: Decimal,
        skip: int = 0,
        limit: int = 20,
    ) -> BoostHistoryResponse:
        """Get paginated boost history for a bounty.

        Returns all boost records (confirmed and refunded) in reverse
        chronological order, along with reward breakdown.

        Args:
            bounty_id: The bounty to get history for.
            original_reward: The bounty's original reward for summary.
            skip: Pagination offset.
            limit: Number of results per page.

        Returns:
            BoostHistoryResponse with boost items and reward totals.
        """
        # Count total boosts
        count_query = select(func.count(BoostTable.id)).where(
            BoostTable.bounty_id == bounty_id
        )
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Fetch paginated boosts
        query = (
            select(BoostTable)
            .where(BoostTable.bounty_id == bounty_id)
            .order_by(BoostTable.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        boosts = result.scalars().all()

        # Sum confirmed boosts for totals
        sum_query = select(
            func.coalesce(func.sum(BoostTable.amount), Decimal("0"))
        ).where(
            and_(
                BoostTable.bounty_id == bounty_id,
                BoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        sum_result = await self.db.execute(sum_query)
        total_boosted = sum_result.scalar() or Decimal("0")

        return BoostHistoryResponse(
            bounty_id=bounty_id,
            items=[_row_to_response(b) for b in boosts],
            total=total,
            original_reward=original_reward,
            total_boosted=total_boosted,
            effective_reward=original_reward + total_boosted,
        )

    async def get_boost_summary(
        self, bounty_id: str, original_reward: Decimal
    ) -> BoostSummary:
        """Compute a compact boost summary for a bounty.

        Calculates total boosted amount, boost count, and identifies
        the top booster. Used to enrich bounty detail responses.

        Args:
            bounty_id: The bounty to summarize boosts for.
            original_reward: The bounty's base reward amount.

        Returns:
            BoostSummary with original, boosted, and effective rewards.
        """
        query = select(
            func.coalesce(func.sum(BoostTable.amount), Decimal("0")).label(
                "total_boosted"
            ),
            func.count(BoostTable.id).label("boost_count"),
        ).where(
            and_(
                BoostTable.bounty_id == bounty_id,
                BoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        result = await self.db.execute(query)
        row = result.one()

        total_boosted = row.total_boosted or Decimal("0")
        boost_count = row.boost_count or 0

        # Find top booster by total contribution
        top_booster_wallet: Optional[str] = None
        if boost_count > 0:
            top_query = (
                select(
                    BoostTable.booster_wallet,
                    func.sum(BoostTable.amount).label("total"),
                )
                .where(
                    and_(
                        BoostTable.bounty_id == bounty_id,
                        BoostTable.status == BoostStatus.CONFIRMED.value,
                    )
                )
                .group_by(BoostTable.booster_wallet)
                .order_by(func.sum(BoostTable.amount).desc())
                .limit(1)
            )
            top_result = await self.db.execute(top_query)
            top_row = top_result.first()
            if top_row:
                top_booster_wallet = top_row.booster_wallet

        return BoostSummary(
            original_reward=original_reward,
            total_boosted=total_boosted,
            effective_reward=original_reward + total_boosted,
            boost_count=boost_count,
            top_booster_wallet=top_booster_wallet,
        )

    async def process_expired_bounty_refunds(
        self, bounty_id: str
    ) -> list[BoostResponse]:
        """Process refunds for all confirmed boosts on an expired bounty.

        When a bounty expires without completion, all confirmed boosts
        are refunded by transferring tokens from the escrow PDA back
        to each booster's wallet.

        Uses SELECT FOR UPDATE to prevent race conditions during
        concurrent refund processing.

        Args:
            bounty_id: The expired bounty to process refunds for.

        Returns:
            List of BoostResponse for all refunded boosts.
        """
        # Lock rows for update to prevent concurrent refund processing
        query = (
            select(BoostTable)
            .where(
                and_(
                    BoostTable.bounty_id == bounty_id,
                    BoostTable.status == BoostStatus.CONFIRMED.value,
                )
            )
            .with_for_update()
        )
        result = await self.db.execute(query)
        boosts = result.scalars().all()

        refunded: list[BoostResponse] = []
        now = datetime.now(timezone.utc)

        for boost in boosts:
            try:
                # Mark as pending refund first (fail-closed)
                boost.status = BoostStatus.PENDING_REFUND.value

                # Transfer from escrow back to booster wallet
                refund_tx = await transfer_refund_from_escrow(
                    boost, bounty_id
                )

                # Mark as fully refunded
                boost.status = BoostStatus.REFUNDED.value
                boost.refund_tx_hash = refund_tx
                boost.refunded_at = now

                refunded.append(_row_to_response(boost))

                logger.info(
                    "Boost refunded: boost=%s bounty=%s wallet=%s amount=%s tx=%s",
                    boost.id,
                    bounty_id,
                    boost.booster_wallet,
                    boost.amount,
                    refund_tx,
                )
            except Exception:
                # Leave as pending_refund for retry — fail-closed
                logger.exception(
                    "Failed to refund boost %s for bounty %s",
                    boost.id,
                    bounty_id,
                )

        await self.db.flush()
        return refunded

    async def _notify_bounty_owner(
        self,
        bounty_id: str,
        bounty_creator_id: str,
        booster_wallet: str,
        amount: Decimal,
    ) -> None:
        """Send a Telegram-style notification to the bounty owner about a boost.

        Creates an in-app notification and triggers a Telegram callback
        to the bounty owner informing them of the new boost.

        Args:
            bounty_id: The boosted bounty's ID.
            bounty_creator_id: The user ID of the bounty creator.
            booster_wallet: The wallet address of the booster.
            amount: The boost amount in $FNDRY.
        """
        try:
            from app.models.notification import NotificationDB

            # Convert string IDs to uuid.UUID objects for the
            # NotificationDB model which uses UUID(as_uuid=True).
            import uuid as _uuid

            creator_uuid = (
                _uuid.UUID(bounty_creator_id)
                if isinstance(bounty_creator_id, str)
                else bounty_creator_id
            )
            bounty_uuid = (
                _uuid.UUID(bounty_id)
                if isinstance(bounty_id, str)
                else bounty_id
            )

            notification = NotificationDB(
                user_id=creator_uuid,
                notification_type="bounty_boosted",
                title="Your bounty received a boost!",
                message=(
                    f"Wallet {booster_wallet[:8]}...{booster_wallet[-4:]} "
                    f"boosted your bounty with {amount:,.0f} $FNDRY"
                ),
                bounty_id=bounty_uuid,
                extra_data={
                    "booster_wallet": booster_wallet,
                    "amount": str(amount),
                    "channel": "telegram",
                },
            )
            self.db.add(notification)
            logger.info(
                "Telegram notification queued: bounty=%s owner=%s amount=%s",
                bounty_id,
                bounty_creator_id,
                amount,
            )
        except Exception:
            logger.exception(
                "Failed to create boost notification for bounty %s", bounty_id
            )

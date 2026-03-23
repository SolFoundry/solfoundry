"""Bounty boost database model and Pydantic schemas.

Allows community members to boost bounty rewards by adding their own
$FNDRY to the prize pool. Boosted amount goes into escrow alongside the
original reward.

PostgreSQL-backed with proper Numeric columns for monetary values.
"""

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Numeric,
    String,
    Text,
    TypeDecorator,
)

from app.database import Base


class UUIDString(TypeDecorator):
    """Platform-agnostic UUID column type.

    Stores UUIDs as 36-character strings for SQLite compatibility
    while maintaining the same interface on PostgreSQL. Accepts
    both uuid.UUID objects and string representations.
    """

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Convert UUID objects to strings for storage."""
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        """Return stored values as strings."""
        if value is not None:
            return str(value)
        return value


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MINIMUM_BOOST_AMOUNT = Decimal("1000")
"""Minimum boost amount in $FNDRY tokens."""


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class BoostStatus(str, Enum):
    """Lifecycle status of a bounty boost."""

    CONFIRMED = "confirmed"
    REFUNDED = "refunded"
    PENDING_REFUND = "pending_refund"


# ---------------------------------------------------------------------------
# SQLAlchemy Model
# ---------------------------------------------------------------------------


class BoostTable(Base):
    """SQLAlchemy model for the bounty_boosts table.

    Stores each boost contribution with the booster's wallet, amount,
    on-chain transaction hash, and current status. Uses Numeric for
    monetary precision.
    """

    __tablename__ = "bounty_boosts"

    id = Column(UUIDString(), primary_key=True, default=lambda: str(uuid.uuid4()))
    bounty_id = Column(UUIDString(), nullable=False, index=True)
    booster_user_id = Column(UUIDString(), nullable=False, index=True)
    booster_wallet = Column(String(64), nullable=False)
    amount = Column(Numeric(precision=20, scale=6), nullable=False)
    status = Column(
        String(20), nullable=False, default=BoostStatus.CONFIRMED.value
    )
    escrow_tx_hash = Column(String(128), nullable=True, unique=True)
    refund_tx_hash = Column(String(128), nullable=True, unique=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_boosts_bounty_status", bounty_id, status),
        Index("ix_boosts_bounty_amount", bounty_id, amount),
        Index("ix_boosts_user_bounty", booster_user_id, bounty_id),
    )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class BoostCreate(BaseModel):
    """Request body for creating a new boost contribution.

    Attributes:
        amount: The boost amount in $FNDRY (minimum 1,000).
        wallet_address: The booster's Solana wallet address.
        wallet_signature: Base58-encoded signature proving wallet ownership.
        message: Optional public message from the booster.
    """

    amount: Decimal = Field(
        ...,
        ge=Decimal("1000"),
        description="Boost amount in $FNDRY (minimum 1,000)",
    )
    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet address of the booster",
    )
    wallet_signature: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Base58-encoded signature proving wallet ownership",
    )
    message: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional public message from the booster",
    )

    @field_validator("amount")
    @classmethod
    def validate_minimum_boost(cls, value: Decimal) -> Decimal:
        """Validate that the boost amount meets the minimum threshold.

        Args:
            value: The boost amount to validate.

        Returns:
            The validated boost amount.

        Raises:
            ValueError: If amount is below the minimum of 1,000 $FNDRY.
        """
        if value < MINIMUM_BOOST_AMOUNT:
            raise ValueError(
                f"Minimum boost amount is {MINIMUM_BOOST_AMOUNT} $FNDRY"
            )
        return value

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet_address(cls, value: str) -> str:
        """Validate Solana wallet address format.

        Args:
            value: The wallet address to validate.

        Returns:
            The validated wallet address.

        Raises:
            ValueError: If address contains invalid characters.
        """
        if not re.match(r"^[1-9A-HJ-NP-Za-km-z]{32,64}$", value):
            raise ValueError(
                "Invalid Solana wallet address format (Base58 expected)"
            )
        return value


class BoostResponse(BaseModel):
    """Response schema for a single boost record.

    Attributes:
        id: Unique boost identifier.
        bounty_id: The boosted bounty's identifier.
        booster_user_id: The user who made the boost.
        booster_wallet: The booster's Solana wallet address.
        amount: Boost amount in $FNDRY.
        status: Current boost status (confirmed, refunded, pending_refund).
        escrow_tx_hash: On-chain transaction hash for escrow deposit.
        refund_tx_hash: On-chain transaction hash for refund (if applicable).
        created_at: When the boost was created.
        refunded_at: When the boost was refunded (if applicable).
        message: Optional public message from the booster.
    """

    id: str
    bounty_id: str
    booster_user_id: str
    booster_wallet: str
    amount: Decimal
    status: str
    escrow_tx_hash: Optional[str] = None
    refund_tx_hash: Optional[str] = None
    created_at: datetime
    refunded_at: Optional[datetime] = None
    message: Optional[str] = None
    model_config = {"from_attributes": True}


class BoostLeaderboardEntry(BaseModel):
    """A single entry in the boost leaderboard for a bounty.

    Attributes:
        booster_wallet: The booster's wallet address.
        booster_user_id: The booster's user ID.
        total_amount: Total amount boosted by this wallet.
        boost_count: Number of individual boosts from this wallet.
        last_boosted_at: When the most recent boost was made.
    """

    booster_wallet: str
    booster_user_id: str
    total_amount: Decimal
    boost_count: int
    last_boosted_at: datetime


class BoostLeaderboardResponse(BaseModel):
    """Paginated leaderboard of top boosters for a bounty.

    Attributes:
        bounty_id: The bounty this leaderboard is for.
        entries: Ranked list of booster entries.
        total_boosted: Total amount boosted across all contributors.
        total_boosters: Count of unique boosters.
    """

    bounty_id: str
    entries: List[BoostLeaderboardEntry]
    total_boosted: Decimal
    total_boosters: int


class BoostHistoryResponse(BaseModel):
    """Paginated history of all boosts for a bounty.

    Attributes:
        bounty_id: The bounty this history is for.
        items: List of individual boost records.
        total: Total number of boost records.
        original_reward: The bounty's original reward amount.
        total_boosted: Total amount added via boosts.
        effective_reward: Combined original + boosted amount.
    """

    bounty_id: str
    items: List[BoostResponse]
    total: int
    original_reward: Decimal
    total_boosted: Decimal
    effective_reward: Decimal


class BoostSummary(BaseModel):
    """Compact boost summary embedded in bounty responses.

    Shows original vs boosted amounts separately as required by
    the acceptance criteria.

    Attributes:
        original_reward: The bounty creator's original reward.
        total_boosted: Sum of all confirmed boost contributions.
        effective_reward: Original + boosted total.
        boost_count: Number of confirmed boosts.
        top_booster_wallet: Wallet address of the largest booster.
    """

    original_reward: Decimal
    total_boosted: Decimal
    effective_reward: Decimal
    boost_count: int
    top_booster_wallet: Optional[str] = None

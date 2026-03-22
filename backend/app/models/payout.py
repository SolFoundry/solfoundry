"""Payout, treasury, and tokenomics Pydantic v2 models.

Defines strict domain types for the bounty payout system including
wallet-address validation, transaction-hash validation, and the
payout state machine (pending -> approved -> processing -> confirmed | failed).

PostgreSQL migration path::

    CREATE TABLE payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient VARCHAR(100) NOT NULL,
        recipient_wallet VARCHAR(44),
        amount NUMERIC NOT NULL CHECK (amount > 0),
        token VARCHAR(10) NOT NULL DEFAULT 'FNDRY',
        bounty_id UUID UNIQUE,
        bounty_title VARCHAR(200),
        tx_hash TEXT UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        solscan_url TEXT,
        admin_approved_by VARCHAR(100),
        retry_count INT NOT NULL DEFAULT 0,
        failure_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_payouts_status ON payouts(status);
    CREATE INDEX idx_payouts_recipient ON payouts(recipient);
    CREATE INDEX idx_payouts_bounty_id ON payouts(bounty_id);
    CREATE INDEX idx_payouts_created_at ON payouts(created_at);
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Solana base-58 address: 32-44 chars of [1-9A-HJ-NP-Za-km-z]
_BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
# Solana tx signature: 64-88 base-58 chars
_TX_HASH_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")

# ---------------------------------------------------------------------------
# Well-known Solana program addresses that must never receive payouts.
# ---------------------------------------------------------------------------
KNOWN_PROGRAM_ADDRESSES: frozenset[str] = frozenset({
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "SysvarC1ock11111111111111111111111111111111",
    "SysvarRent111111111111111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
})


def validate_solana_wallet(address: str) -> str:
    """Validate a Solana wallet address and reject known program addresses.

    Args:
        address: The wallet address string to validate.

    Returns:
        The validated address if it passes all checks.

    Raises:
        ValueError: If the address is not valid base-58 or is a known
            program address.
    """
    if not _BASE58_RE.match(address):
        raise ValueError("Wallet must be a valid Solana base-58 address (32-44 alphanumeric characters, no 0/O/I/l)")
    if address in KNOWN_PROGRAM_ADDRESSES:
        raise ValueError(f"Wallet '{address}' is a known program address and cannot receive payouts")
    return address


# ---------------------------------------------------------------------------
# Payout status enum and state machine
# ---------------------------------------------------------------------------

class PayoutStatus(str, Enum):
    """Lifecycle states for a payout queue entry.

    State machine::

        pending -> approved -> processing -> confirmed
                |                         |
                +-> failed                +-> failed
    """

    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    CONFIRMED = "confirmed"
    FAILED = "failed"


ALLOWED_TRANSITIONS: dict[PayoutStatus, frozenset[PayoutStatus]] = {
    PayoutStatus.PENDING: frozenset({PayoutStatus.APPROVED, PayoutStatus.FAILED}),
    PayoutStatus.APPROVED: frozenset({PayoutStatus.PROCESSING}),
    PayoutStatus.PROCESSING: frozenset({PayoutStatus.CONFIRMED, PayoutStatus.FAILED}),
    PayoutStatus.CONFIRMED: frozenset(),
    PayoutStatus.FAILED: frozenset(),
}


# ---------------------------------------------------------------------------
# Internal storage model
# ---------------------------------------------------------------------------

class PayoutRecord(BaseModel):
    """Internal storage model for a single payout queue entry.

    Tracks the full lifecycle from creation through admin approval,
    on-chain transfer execution, and confirmation.  The ``updated_at``
    field is refreshed on every state transition.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique payout identifier (UUID)")
    recipient: str = Field(..., min_length=1, max_length=100, description="Recipient username or GitHub handle")
    recipient_wallet: Optional[str] = Field(default=None, description="Recipient Solana wallet address")
    amount: float = Field(..., gt=0, description="Payout amount in the specified token (must be positive)")
    token: str = Field(default="FNDRY", pattern=r"^(FNDRY|SOL)$", description="Token type: FNDRY or SOL")
    bounty_id: Optional[str] = Field(default=None, description="Associated bounty UUID for double-pay prevention")
    bounty_title: Optional[str] = Field(default=None, max_length=200, description="Human-readable bounty title")
    tx_hash: Optional[str] = Field(default=None, description="On-chain Solana transaction signature")
    status: PayoutStatus = Field(default=PayoutStatus.PENDING, description="Current lifecycle state")
    solscan_url: Optional[str] = Field(default=None, description="Solscan explorer link for the transaction")
    admin_approved_by: Optional[str] = Field(default=None, description="Admin who approved or rejected this payout")
    retry_count: int = Field(default=0, ge=0, description="Number of transfer retry attempts made")
    failure_reason: Optional[str] = Field(default=None, description="Error message if the payout failed")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when the payout was created")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of the last state change")

    @field_validator("recipient_wallet")
    @classmethod
    def validate_wallet(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *recipient_wallet* is a valid, non-program Solana address.

        Args:
            v: The wallet address to validate, or ``None``.

        Returns:
            The validated address, or ``None`` if not provided.

        Raises:
            ValueError: If the address fails base-58 or program-address checks.
        """
        if v is not None:
            validate_solana_wallet(v)
        return v

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature (64-88 base-58 chars).

        Args:
            v: The transaction hash to validate, or ``None``.

        Returns:
            The validated hash, or ``None`` if not provided.

        Raises:
            ValueError: If the hash does not match the expected format.
        """
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature (64-88 base-58 characters)")
        return v


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class PayoutCreate(BaseModel):
    """Request body for recording a new payout.

    When ``tx_hash`` is provided the payout is immediately marked as
    ``confirmed``; otherwise it enters the queue as ``pending`` and
    must go through admin approval before on-chain execution.
    """

    recipient: str = Field(..., min_length=1, max_length=100, description="Recipient username or ID", examples=["cryptodev"])
    recipient_wallet: Optional[str] = Field(None, description="Solana wallet address for the payout", examples=["7Pq6..."])
    amount: float = Field(..., gt=0, description="Payout amount (must be positive)", examples=[100.0])
    token: str = Field(default="FNDRY", pattern=r"^(FNDRY|SOL)$", description="Token to use for payout", examples=["FNDRY"])
    bounty_id: Optional[str] = Field(None, description="Associated bounty UUID (enforces one payout per bounty)", examples=["550e8400-e29b-41d4-a716-446655440000"])
    bounty_title: Optional[str] = Field(default=None, max_length=200, description="Title of the bounty for reference")
    tx_hash: Optional[str] = Field(None, description="Solana transaction signature (pre-confirmed payout)", examples=["5fX..."])

    @field_validator("recipient_wallet")
    @classmethod
    def validate_wallet(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *recipient_wallet* is a valid, non-program Solana address.

        Args:
            v: The wallet address to validate, or ``None``.

        Returns:
            The validated address, or ``None`` if not provided.

        Raises:
            ValueError: If the address fails validation.
        """
        if v is not None:
            validate_solana_wallet(v)
        return v

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature.

        Args:
            v: The transaction hash to validate, or ``None``.

        Returns:
            The validated hash, or ``None`` if not provided.

        Raises:
            ValueError: If the hash format is invalid.
        """
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature (64-88 base-58 characters)")
        return v


class PayoutResponse(BaseModel):
    """Single payout API response with full lifecycle metadata.

    Includes the Solscan explorer URL, retry count, and failure
    reason for transparent status tracking.
    """

    id: str = Field(..., description="Unique payout identifier")
    recipient: str = Field(..., description="Recipient username or handle")
    recipient_wallet: Optional[str] = Field(default=None, description="Recipient Solana wallet address")
    amount: float = Field(..., description="Payout amount in the specified token")
    token: str = Field(..., description="Token type (FNDRY or SOL)")
    bounty_id: Optional[str] = Field(default=None, description="Associated bounty UUID")
    bounty_title: Optional[str] = Field(default=None, description="Human-readable bounty title")
    tx_hash: Optional[str] = Field(default=None, description="On-chain transaction signature")
    status: PayoutStatus = Field(..., description="Current payout lifecycle state")
    solscan_url: Optional[str] = Field(default=None, description="Solscan explorer link")
    retry_count: int = Field(default=0, description="Number of transfer retry attempts")
    failure_reason: Optional[str] = Field(default=None, description="Error message if payout failed")
    created_at: datetime = Field(..., description="Creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last state-change timestamp (UTC)")


class PayoutListResponse(BaseModel):
    """Paginated list of payouts with total count for cursor-based navigation."""

    items: list[PayoutResponse] = Field(..., description="Page of payout records")
    total: int = Field(..., description="Total matching records across all pages")
    skip: int = Field(..., description="Number of records skipped (offset)")
    limit: int = Field(..., description="Maximum records per page")


class AdminApprovalRequest(BaseModel):
    """Request body for admin payout approval or rejection.

    Set ``approved=True`` to advance the payout to the ``approved``
    state, or ``approved=False`` to reject it (moves to ``failed``).
    """

    approved: bool = Field(..., description="True to approve, False to reject")
    admin_id: str = Field(..., min_length=1, max_length=100, description="Admin identifier performing the action")
    reason: Optional[str] = Field(None, max_length=500, description="Optional reason for rejection")


class AdminApprovalResponse(BaseModel):
    """Response after processing an admin approval or rejection decision."""

    payout_id: str = Field(..., description="The payout that was acted on")
    status: PayoutStatus = Field(..., description="Resulting payout status")
    admin_id: str = Field(..., description="Admin who performed the action")
    message: str = Field(..., description="Human-readable result message")


# ---------------------------------------------------------------------------
# Wallet validation schemas
# ---------------------------------------------------------------------------

class WalletValidationRequest(BaseModel):
    """Request body for validating a Solana wallet address.

    Used to pre-check addresses before creating payouts.
    """

    wallet_address: str = Field(..., min_length=1, max_length=50, description="Solana address to validate")


class WalletValidationResponse(BaseModel):
    """Result of wallet address validation with details on why it failed."""

    wallet_address: str = Field(..., description="The address that was validated")
    valid: bool = Field(..., description="Whether the address is valid for receiving payouts")
    is_program_address: bool = Field(default=False, description="True if the address is a known program address")
    message: str = Field(..., description="Human-readable validation result")


# ---------------------------------------------------------------------------
# Treasury & tokenomics schemas
# ---------------------------------------------------------------------------

class TreasuryStats(BaseModel):
    """Live treasury balance and aggregate statistics.

    Combines on-chain RPC balance data with in-memory payout and
    buyback aggregates for a single dashboard view.
    """

    sol_balance: float = Field(0.0, description="Total SOL held in treasury", examples=[1250.5])
    fndry_balance: float = Field(0.0, description="Total FNDRY tokens held in treasury", examples=[500000.0])
    treasury_wallet: str = Field(..., description="Public address of the treasury wallet", examples=["AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1"])
    total_paid_out_fndry: float = Field(0.0, description="Cumulative FNDRY paid to contributors")
    total_paid_out_sol: float = Field(0.0, description="Cumulative SOL paid to contributors")
    total_payouts: int = Field(0, description="Total number of confirmed payout events")
    total_buyback_amount: float = Field(0.0, description="Total SOL spent on FNDRY buybacks")
    total_buybacks: int = Field(0, description="Total number of buyback events")
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Snapshot timestamp")


# ---------------------------------------------------------------------------
# Buyback schemas
# ---------------------------------------------------------------------------

class BuybackRecord(BaseModel):
    """Internal storage model for a buyback event.

    Buybacks track SOL spent to acquire FNDRY tokens from the open
    market, reducing circulating supply.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique buyback identifier")
    amount_sol: float = Field(..., gt=0, description="SOL spent on the buyback")
    amount_fndry: float = Field(..., gt=0, description="FNDRY tokens acquired")
    price_per_fndry: float = Field(..., gt=0, description="Effective price per FNDRY in SOL")
    tx_hash: Optional[str] = Field(default=None, description="On-chain transaction signature")
    solscan_url: Optional[str] = Field(default=None, description="Solscan explorer link")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Creation timestamp")

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature.

        Args:
            v: The transaction hash to validate, or ``None``.

        Returns:
            The validated hash, or ``None`` if not provided.

        Raises:
            ValueError: If the hash format is invalid.
        """
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class BuybackCreate(BaseModel):
    """Request body for recording a buyback event."""

    amount_sol: float = Field(..., gt=0, description="SOL spent on buyback")
    amount_fndry: float = Field(..., gt=0, description="FNDRY tokens acquired")
    price_per_fndry: float = Field(..., gt=0, description="Price per FNDRY in SOL")
    tx_hash: Optional[str] = Field(default=None, description="On-chain transaction signature")

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature.

        Args:
            v: The transaction hash to validate, or ``None``.

        Returns:
            The validated hash, or ``None`` if not provided.

        Raises:
            ValueError: If the hash format is invalid.
        """
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class BuybackResponse(BaseModel):
    """Single buyback API response."""

    id: str = Field(..., description="Unique buyback identifier")
    amount_sol: float = Field(..., description="SOL spent on the buyback")
    amount_fndry: float = Field(..., description="FNDRY tokens acquired")
    price_per_fndry: float = Field(..., description="Effective price per FNDRY in SOL")
    tx_hash: Optional[str] = Field(default=None, description="On-chain transaction signature")
    solscan_url: Optional[str] = Field(default=None, description="Solscan explorer link")
    created_at: datetime = Field(..., description="Creation timestamp")


class BuybackListResponse(BaseModel):
    """Paginated list of buybacks."""

    items: list[BuybackResponse] = Field(..., description="Page of buyback records")
    total: int = Field(..., description="Total matching records across all pages")
    skip: int = Field(..., description="Number of records skipped")
    limit: int = Field(..., description="Maximum records per page")


class TokenomicsResponse(BaseModel):
    """$FNDRY tokenomics breakdown.

    ``circulating_supply = total_supply - treasury_holdings``.
    This gives a real-time view of token distribution across
    the SolFoundry ecosystem.
    """

    token_name: str = Field(default="FNDRY", description="Token symbol")
    token_ca: str = Field(default="C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS", description="Token contract address on Solana")
    total_supply: float = Field(default=1_000_000_000.0, description="Total token supply")
    circulating_supply: float = Field(default=0.0, description="Tokens in circulation (total - treasury)")
    treasury_holdings: float = Field(default=0.0, description="Tokens held in treasury")
    total_distributed: float = Field(default=0.0, description="Total tokens distributed to contributors")
    total_buybacks: float = Field(default=0.0, description="Total FNDRY acquired via buybacks")
    total_burned: float = Field(default=0.0, description="Total tokens permanently burned")
    fee_revenue_sol: float = Field(default=0.0, description="Total SOL collected in fees / buyback spend")
    distribution_breakdown: dict[str, float] = Field(
        default_factory=lambda: {
            "contributor_rewards": 0.0,
            "treasury_reserve": 0.0,
            "buybacks": 0.0,
            "burned": 0.0,
        },
        description="Breakdown of token distribution by category",
    )
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Snapshot timestamp")

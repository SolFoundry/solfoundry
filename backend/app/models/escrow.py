"""$FNDRY escrow models -- Pydantic schemas + SQLAlchemy with PostgreSQL.

State machine:
    PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED
                                -> REFUNDING -> REFUNDED
    RELEASING reverts to ACTIVE on transfer failure.
    REFUNDING reverts to prior state on transfer failure.

Monetary amounts use Numeric(20,9) in DB and Decimal in Python to avoid float rounding.
"""
import re, uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column as C, DateTime, Numeric, ForeignKey, String as S
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

_B58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")
MAX_ESCROW_AMOUNT = Decimal("10_000_000_000")

def _validate_wallet(v: Optional[str]) -> Optional[str]:
    """Validate Solana base-58 address format."""
    if v is not None and not _B58.match(v): raise ValueError("Invalid Solana address format")
    return v

def _validate_tx_hash(v: Optional[str]) -> Optional[str]:
    """Validate Solana transaction signature format (base-58, 64-88 chars)."""
    if v is not None and not _TX.match(v): raise ValueError("Invalid Solana tx signature format")
    return v

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "PENDING": frozenset({"FUNDED", "REFUNDING"}),
    "FUNDED": frozenset({"ACTIVE", "RELEASING", "REFUNDING"}),
    "ACTIVE": frozenset({"RELEASING", "REFUNDING"}),
    "RELEASING": frozenset({"COMPLETED", "ACTIVE"}),  # ACTIVE for failure rollback
    "REFUNDING": frozenset({"REFUNDED", "PENDING", "FUNDED", "ACTIVE"}),  # revert on failure
    "COMPLETED": frozenset(), "REFUNDED": frozenset()}

class EscrowState(str, Enum):
    """Escrow lifecycle: PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED | REFUNDING -> REFUNDED."""
    PENDING = "PENDING"; FUNDED = "FUNDED"; ACTIVE = "ACTIVE"
    RELEASING = "RELEASING"; REFUNDING = "REFUNDING"
    COMPLETED = "COMPLETED"; REFUNDED = "REFUNDED"

_now = lambda: datetime.now(timezone.utc)
_uid = lambda: str(uuid.uuid4())
_DT = DateTime(timezone=True)

class EscrowAccountTable(Base):
    """Escrow accounts PostgreSQL table — one per bounty with state, wallets, tx hashes."""
    __tablename__ = "escrow_accounts"
    id = C(UUID(as_uuid=False), primary_key=True, default=_uid)
    bounty_id = C(S(100), unique=True, nullable=False, index=True)
    creator_wallet = C(S(44), nullable=False)
    creator_user_id = C(S(36), nullable=False, index=True)
    winner_wallet = C(S(44))
    amount = C(Numeric(precision=20, scale=9), nullable=False)
    state = C(S(20), nullable=False, default=EscrowState.PENDING.value)
    fund_tx_hash = C(S(88), unique=True)
    release_tx_hash = C(S(88), unique=True)
    refund_tx_hash = C(S(88), unique=True)
    created_at = C(_DT, nullable=False, default=_now)
    updated_at = C(_DT, nullable=False, default=_now, onupdate=_now)
    expires_at = C(_DT)
    ledger_entries = relationship("EscrowLedgerTable", back_populates="escrow", lazy="selectin")

class EscrowLedgerTable(Base):
    """Immutable append-only ledger for escrow deposit/release/refund events."""
    __tablename__ = "escrow_ledger"
    id = C(UUID(as_uuid=False), primary_key=True, default=_uid)
    escrow_id = C(UUID(as_uuid=False), ForeignKey("escrow_accounts.id", ondelete="CASCADE"), nullable=False)
    action = C(S(20), nullable=False)
    amount = C(Numeric(precision=20, scale=9), nullable=False)
    tx_hash = C(S(88))
    wallet = C(S(44), nullable=False)
    created_at = C(_DT, nullable=False, default=_now)
    escrow = relationship("EscrowAccountTable", back_populates="ledger_entries")

class LedgerEntry(BaseModel):
    """Ledger row response schema."""
    model_config = {"from_attributes": True}
    id: str; escrow_id: str
    action: str = Field(..., pattern=r"^(deposit|release|refund)$")
    amount: Decimal = Field(..., gt=0); tx_hash: Optional[str] = None
    wallet: str = Field(..., min_length=32, max_length=44); created_at: datetime
    _v1 = field_validator("wallet")(_validate_wallet)
    _v2 = field_validator("tx_hash")(_validate_tx_hash)

class EscrowCreateRequest(BaseModel):
    """POST /escrow/fund request. tx_hash present -> FUNDED, absent -> PENDING."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    amount: Decimal = Field(..., gt=0)
    tx_hash: Optional[str] = None; expires_at: Optional[datetime] = None
    _v1 = field_validator("creator_wallet")(_validate_wallet)
    _v2 = field_validator("tx_hash")(_validate_tx_hash)

    @field_validator("amount")
    @classmethod
    def validate_amount_upper_bound(cls, v: Decimal) -> Decimal:
        """Reject amounts exceeding max escrow limit."""
        if v > MAX_ESCROW_AMOUNT: raise ValueError(f"Amount exceeds maximum ({MAX_ESCROW_AMOUNT})")
        return v

    @field_validator("expires_at")
    @classmethod
    def validate_expires_in_future(cls, v: Optional[datetime]) -> Optional[datetime]:
        """Reject past expiration timestamps."""
        if v is not None:
            cmp = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if cmp <= datetime.now(timezone.utc): raise ValueError("expires_at must be a future timestamp")
        return v

class EscrowReleaseRequest(BaseModel):
    """POST /escrow/release request."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    winner_wallet: str = Field(..., min_length=32, max_length=44)
    _v1 = field_validator("winner_wallet")(_validate_wallet)

class EscrowRefundRequest(BaseModel):
    """POST /escrow/refund request."""
    bounty_id: str = Field(..., min_length=1, max_length=100)

class EscrowResponse(BaseModel):
    """Escrow API response with full state, hashes, and ledger."""
    model_config = {"from_attributes": True}
    id: str; bounty_id: str; creator_wallet: str; winner_wallet: Optional[str] = None
    amount: Decimal; state: EscrowState
    fund_tx_hash: Optional[str] = None; release_tx_hash: Optional[str] = None
    refund_tx_hash: Optional[str] = None
    created_at: datetime; updated_at: datetime; expires_at: Optional[datetime] = None
    ledger: list[LedgerEntry] = Field(default_factory=list)

class EscrowListResponse(BaseModel):
    """Paginated escrow list."""
    items: list[EscrowResponse]; total: int; skip: int; limit: int

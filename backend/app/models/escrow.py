"""$FNDRY escrow models -- Pydantic schemas + SQLAlchemy with PostgreSQL."""
import re, uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column as C, DateTime, Float, ForeignKey, String as S
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
_B58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")
VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "PENDING": frozenset({"FUNDED", "REFUNDED"}), "FUNDED": frozenset({"ACTIVE", "REFUNDED"}),
    "ACTIVE": frozenset({"RELEASING", "REFUNDED"}), "RELEASING": frozenset({"COMPLETED"}),
    "COMPLETED": frozenset(), "REFUNDED": frozenset()}
def _vw(v: Optional[str]) -> Optional[str]:
    """Validate Solana base-58 address."""
    if v is not None and not _B58.match(v): raise ValueError("Invalid Solana address")
    return v
def _vt(v: Optional[str]) -> Optional[str]:
    """Validate Solana tx signature."""
    if v is not None and not _TX.match(v): raise ValueError("Invalid Solana tx signature")
    return v
class EscrowState(str, Enum):
    """PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED | REFUNDED."""
    PENDING = "PENDING"; FUNDED = "FUNDED"; ACTIVE = "ACTIVE"
    RELEASING = "RELEASING"; COMPLETED = "COMPLETED"; REFUNDED = "REFUNDED"
_now = lambda: datetime.now(timezone.utc)
_uid = lambda: str(uuid.uuid4())
_DT = DateTime(timezone=True)
class EscrowAccountTable(Base):
    """Escrow accounts PostgreSQL table."""
    __tablename__ = "escrow_accounts"
    id = C(UUID(as_uuid=False), primary_key=True, default=_uid)
    bounty_id = C(S(100), unique=True, nullable=False, index=True)
    creator_wallet = C(S(44), nullable=False)
    creator_user_id = C(S(36), nullable=False, index=True)
    winner_wallet = C(S(44))
    amount = C(Float, nullable=False)
    state = C(S(20), nullable=False, default=EscrowState.PENDING.value)
    fund_tx_hash = C(S(88), unique=True)
    release_tx_hash = C(S(88), unique=True)
    refund_tx_hash = C(S(88), unique=True)
    created_at = C(_DT, nullable=False, default=_now)
    updated_at = C(_DT, nullable=False, default=_now, onupdate=_now)
    expires_at = C(_DT)
    ledger_entries = relationship("EscrowLedgerTable", back_populates="escrow", lazy="selectin")
class EscrowLedgerTable(Base):
    """Escrow ledger PostgreSQL table."""
    __tablename__ = "escrow_ledger"
    id = C(UUID(as_uuid=False), primary_key=True, default=_uid)
    escrow_id = C(UUID(as_uuid=False), ForeignKey("escrow_accounts.id", ondelete="CASCADE"), nullable=False)
    action = C(S(20), nullable=False)
    amount = C(Float, nullable=False)
    tx_hash = C(S(88))
    wallet = C(S(44), nullable=False)
    created_at = C(_DT, nullable=False, default=_now)
    escrow = relationship("EscrowAccountTable", back_populates="ledger_entries")
class LedgerEntry(BaseModel):
    """Ledger row response."""
    model_config = {"from_attributes": True}
    id: str; escrow_id: str
    action: str = Field(..., pattern=r"^(deposit|release|refund)$")
    amount: float = Field(..., gt=0); tx_hash: Optional[str] = None
    wallet: str = Field(..., min_length=32, max_length=44); created_at: datetime
    _v1 = field_validator("wallet")(_vw); _v2 = field_validator("tx_hash")(_vt)
class EscrowCreateRequest(BaseModel):
    """POST /escrow/fund request."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0); tx_hash: Optional[str] = None; expires_at: Optional[datetime] = None
    _v1 = field_validator("creator_wallet")(_vw); _v2 = field_validator("tx_hash")(_vt)
class EscrowReleaseRequest(BaseModel):
    """POST /escrow/release request."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    winner_wallet: str = Field(..., min_length=32, max_length=44)
    _v1 = field_validator("winner_wallet")(_vw)
class EscrowRefundRequest(BaseModel):
    """POST /escrow/refund request."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
class EscrowResponse(BaseModel):
    """Escrow API response with ledger."""
    model_config = {"from_attributes": True}
    id: str; bounty_id: str; creator_wallet: str; winner_wallet: Optional[str] = None
    amount: float; state: EscrowState
    fund_tx_hash: Optional[str] = None; release_tx_hash: Optional[str] = None; refund_tx_hash: Optional[str] = None
    created_at: datetime; updated_at: datetime; expires_at: Optional[datetime] = None
    ledger: list[LedgerEntry] = Field(default_factory=list)
class EscrowListResponse(BaseModel):
    """Paginated escrow list."""
    items: list[EscrowResponse]; total: int; skip: int; limit: int

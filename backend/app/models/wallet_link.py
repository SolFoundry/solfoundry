"""Wallet-to-user linking database model and Pydantic schemas.

This module defines the data models for linking Solana wallets to user accounts.
Each user can have multiple wallets linked, but each wallet can only be linked
to one user. The linking requires cryptographic signature verification to prove
wallet ownership.

PostgreSQL is the primary data store — no in-memory fallbacks.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Boolean,
    Integer,
    Text,
    Index,
    ForeignKey,
    UniqueConstraint,
    Uuid,
)

from app.database import Base


class WalletProvider(str, Enum):
    """Supported Solana wallet providers.

    Each provider may encode signatures differently:
    - Phantom: base58-encoded signatures
    - Solflare: base58-encoded signatures
    - Backpack: base58-encoded signatures (xNFT compatible)
    - Unknown: fallback for unrecognized providers
    """

    PHANTOM = "phantom"
    SOLFLARE = "solflare"
    BACKPACK = "backpack"
    UNKNOWN = "unknown"


class WalletLink(Base):
    """Database model for wallet-to-user links.

    Stores the association between a Solana wallet address and a user account.
    Each wallet address is globally unique — it cannot be linked to multiple users.
    The link is verified through Ed25519 signature verification at creation time.

    Attributes:
        id: Primary key UUID.
        user_id: Foreign key to the users table.
        wallet_address: The Solana wallet public key (base58-encoded, 32-44 chars).
        provider: The wallet provider used for linking (Phantom, Solflare, Backpack).
        label: Optional user-friendly label for the wallet.
        is_primary: Whether this is the user's primary wallet for payouts.
        verified_at: Timestamp when the wallet ownership was verified via signature.
        created_at: Timestamp when the link was created.
        updated_at: Timestamp of the last update.
    """

    __tablename__ = "wallet_links"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wallet_address = Column(String(64), nullable=False, index=True)
    provider = Column(
        String(32),
        nullable=False,
        default=WalletProvider.UNKNOWN.value,
    )
    label = Column(String(128), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    verified_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("wallet_address", name="uq_wallet_links_address"),
        Index("ix_wallet_links_user_primary", user_id, is_primary),
    )


# ---------------------------------------------------------------------------
# Pydantic request/response schemas
# ---------------------------------------------------------------------------


class WalletLinkCreateRequest(BaseModel):
    """Request schema for linking a wallet to a user account.

    The caller must provide a signed SIWS message to prove wallet ownership.
    The signature is verified server-side using Ed25519 before the link is created.

    Attributes:
        wallet_address: Solana wallet public key (base58-encoded).
        signature: Base64-encoded Ed25519 signature of the challenge message.
        message: The exact SIWS challenge message that was signed.
        nonce: The nonce from the challenge message for replay protection.
        provider: The wallet provider used (phantom, solflare, backpack).
        label: Optional user-friendly label for the wallet.
        is_primary: Whether to set this as the primary wallet.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet public key (base58-encoded)",
    )
    signature: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded Ed25519 signature of the challenge message",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The exact SIWS challenge message that was signed",
    )
    nonce: str = Field(
        ...,
        min_length=1,
        description="Nonce from the challenge message for replay protection",
    )
    provider: WalletProvider = Field(
        default=WalletProvider.UNKNOWN,
        description="The wallet provider used for signing",
    )
    label: Optional[str] = Field(
        None,
        max_length=128,
        description="Optional user-friendly label for the wallet",
    )
    is_primary: bool = Field(
        default=False,
        description="Whether to set this as the primary wallet",
    )


class WalletLinkResponse(BaseModel):
    """Response schema for a wallet link.

    Attributes:
        id: The wallet link UUID.
        user_id: The linked user's UUID.
        wallet_address: The Solana wallet public key.
        provider: The wallet provider.
        label: Optional user-friendly label.
        is_primary: Whether this is the primary wallet.
        verified_at: When ownership was verified.
        created_at: When the link was created.
    """

    id: str
    user_id: str
    wallet_address: str
    provider: str
    label: Optional[str] = None
    is_primary: bool
    verified_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletLinkListResponse(BaseModel):
    """Paginated list of wallet links for a user.

    Attributes:
        items: List of wallet link responses.
        total: Total number of linked wallets.
    """

    items: List[WalletLinkResponse]
    total: int


class WalletUnlinkRequest(BaseModel):
    """Request schema for unlinking a wallet.

    Attributes:
        wallet_address: The wallet address to unlink.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="The wallet address to unlink",
    )


class WalletUnlinkResponse(BaseModel):
    """Response after unlinking a wallet.

    Attributes:
        success: Whether the unlink was successful.
        wallet_address: The wallet address that was unlinked.
        message: Human-readable result message.
    """

    success: bool
    wallet_address: str
    message: str


class SetPrimaryWalletRequest(BaseModel):
    """Request schema for setting a wallet as primary.

    Attributes:
        wallet_address: The wallet address to set as primary.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="The wallet address to set as primary",
    )

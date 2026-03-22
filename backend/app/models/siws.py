"""ORM models for SIWS nonces and wallet sessions."""

import uuid

from sqlalchemy import Boolean, Column, DateTime, String

from app.database import Base, GUID


class SiwsNonceTable(Base):
    """One-time nonces for the SIWS challenge-response flow.

    Each nonce is valid for 10 minutes and is marked `used=True` once
    consumed.  Expired rows are pruned lazily on every new nonce creation.
    """

    __tablename__ = "siws_nonces"

    nonce = Column(String(64), primary_key=True)
    wallet_address = Column(String(64), nullable=False, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used = Column(Boolean, nullable=False, default=False)


class WalletSessionTable(Base):
    """Active wallet sessions — one row per issued token.

    Stores a SHA-256 hash of the JWT so individual tokens can be revoked
    without invalidating an entire user account.
    Both access and refresh tokens get their own row.
    """

    __tablename__ = "wallet_sessions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(64), nullable=False, index=True)
    user_id = Column(GUID, nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    token_type = Column(String(16), nullable=False)  # "access" | "refresh"
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked = Column(Boolean, nullable=False, default=False)

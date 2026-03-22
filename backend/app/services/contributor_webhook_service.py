"""Contributor webhook CRUD service.

Responsibilities:
    - Secret generation and Fernet encryption/decryption.
    - Enforcing the per-user webhook limit (max 10).
    - Creating, listing, and deleting webhook registrations.
    - Retrieving active webhooks for event dispatch.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contributor_webhook import (
    ContributorWebhookDB,
    WebhookCreateResponse,
    WebhookResponse,
)

logger = logging.getLogger(__name__)

MAX_WEBHOOKS_PER_USER: int = 10


# ---------------------------------------------------------------------------
# Secret encryption helpers
# ---------------------------------------------------------------------------


def _fernet_key() -> bytes:
    """Derive a 32-byte URL-safe base64 Fernet key from the app SECRET_KEY."""
    raw = os.getenv("SECRET_KEY", "insecure-dev-secret-change-in-production")
    digest = hashlib.sha256(raw.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _encrypt_secret(raw_secret: str) -> str:
    from cryptography.fernet import Fernet

    f = Fernet(_fernet_key())
    return f.encrypt(raw_secret.encode()).decode()


def decrypt_secret(encrypted: str) -> str:
    """Decrypt a stored webhook secret for HMAC signing."""
    from cryptography.fernet import Fernet

    f = Fernet(_fernet_key())
    return f.decrypt(encrypted.encode()).decode()


def _hash_secret(raw_secret: str) -> str:
    """Return SHA-256 hex digest of raw_secret (stored for integrity checks)."""
    return hashlib.sha256(raw_secret.encode()).hexdigest()


def _generate_secret() -> str:
    """Generate a 32-byte cryptographically secure hex secret."""
    return secrets.token_hex(32)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ContributorWebhookService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_user_webhooks(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ContributorWebhookDB)
            .where(
                ContributorWebhookDB.user_id == user_id,
                ContributorWebhookDB.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one()

    async def create_webhook(self, user_id: str, url: str) -> WebhookCreateResponse:
        count = await self.count_user_webhooks(user_id)
        if count >= MAX_WEBHOOKS_PER_USER:
            raise ValueError(
                f"Webhook limit reached. Maximum {MAX_WEBHOOKS_PER_USER} webhooks per user."
            )

        raw_secret = _generate_secret()
        record = ContributorWebhookDB(
            user_id=user_id,
            url=url,
            secret_encrypted=_encrypt_secret(raw_secret),
            secret_hash=_hash_secret(raw_secret),
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)

        logger.info("Webhook registered: id=%s user=%s", record.id, user_id)
        return WebhookCreateResponse(
            id=str(record.id),
            url=record.url,
            is_active=record.is_active,
            created_at=record.created_at,
            secret=raw_secret,
        )

    async def list_webhooks(self, user_id: str) -> list[WebhookResponse]:
        result = await self.db.execute(
            select(ContributorWebhookDB)
            .where(
                ContributorWebhookDB.user_id == user_id,
                ContributorWebhookDB.is_active == True,  # noqa: E712
            )
            .order_by(ContributorWebhookDB.created_at.desc())
        )
        rows = result.scalars().all()
        return [
            WebhookResponse(
                id=str(r.id),
                url=r.url,
                is_active=r.is_active,
                created_at=r.created_at,
            )
            for r in rows
        ]

    async def delete_webhook(self, webhook_id: str, user_id: str) -> bool:
        """Soft-delete (deactivate) a webhook.

        Returns True if deleted, False if not found or not owned by user_id.
        """
        result = await self.db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.id == webhook_id,
                ContributorWebhookDB.is_active == True,  # noqa: E712
            )
        )
        record = result.scalar_one_or_none()

        if record is None:
            return False
        if record.user_id != user_id:
            return False

        record.is_active = False
        await self.db.commit()
        logger.info("Webhook deactivated: id=%s user=%s", webhook_id, user_id)
        return True

    async def get_active_webhooks_for_user(
        self, user_id: str
    ) -> list[ContributorWebhookDB]:
        """Return all active webhook records for a user (used by dispatcher)."""
        result = await self.db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.user_id == user_id,
                ContributorWebhookDB.is_active == True,  # noqa: E712
            )
        )
        return list(result.scalars().all())

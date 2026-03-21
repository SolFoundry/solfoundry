"""Service for managing email preferences per contributor."""

from __future__ import annotations

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.email_preferences import (
    EmailPreferencesModel,
    EmailPreferencesUpdate,
    get_default_preferences,
)


class EmailPreferencesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_preferences(self, user_id: str) -> EmailPreferencesModel:
        query = select(EmailPreferencesModel).where(
            EmailPreferencesModel.user_id == user_id
        )
        result = await self.db.exec(query)
        prefs = result.one_or_none()

        if not prefs:
            prefs = EmailPreferencesModel(
                user_id=user_id,
                preferences=get_default_preferences(),
                email_enabled=True,
            )
            self.db.add(prefs)
            await self.db.commit()
            await self.db.refresh(prefs)

        return prefs

    async def update_preferences(
        self, user_id: str, update: EmailPreferencesUpdate
    ) -> EmailPreferencesModel:
        prefs = await self.get_preferences(user_id)

        if update.email_enabled is not None:
            prefs.email_enabled = update.email_enabled

        if update.preferences is not None:
            current = dict(prefs.preferences)
            current.update(update.preferences)
            prefs.preferences = current

        await self.db.commit()
        await self.db.refresh(prefs)
        return prefs

    async def is_email_enabled(
        self, user_id: str, notification_type: str
    ) -> bool:
        prefs = await self.get_preferences(user_id)
        if not prefs.email_enabled:
            return False
        return prefs.preferences.get(notification_type, True)

    async def unsubscribe_all(self, user_id: str) -> EmailPreferencesModel:
        prefs = await self.get_preferences(user_id)
        prefs.email_enabled = False
        await self.db.commit()
        await self.db.refresh(prefs)
        return prefs

    async def resubscribe_all(self, user_id: str) -> EmailPreferencesModel:
        prefs = await self.get_preferences(user_id)
        prefs.email_enabled = True
        prefs.preferences = get_default_preferences()
        await self.db.commit()
        await self.db.refresh(prefs)
        return prefs

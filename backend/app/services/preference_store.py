"""Persistent user notification-preference storage.

Uses a JSON file on disk (``data/preferences.json``) so preferences survive
process restarts — unlike the in-memory dict in competing PRs. The file lives
under ``backend/data/`` which is gitignored, so it never pollutes the repo.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from app.models.email import NotificationFrequency, PreferenceUpdate

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_DEFAULT_FILE = os.path.join(_DATA_DIR, "preferences.json")

DEFAULT_PREFERENCE = {
    "frequency": "instant",
    "notify_new_bounty": True,
    "notify_status_update": True,
    "notify_payout": True,
    "digest_day": None,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PreferenceStore:
    """Thread-safe JSON-file-backed preference store keyed by user id."""

    def __init__(self, path: str = _DEFAULT_FILE) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._data: dict = {}
        self._load()

    def _load(self) -> None:
        try:
            with open(self.path) as fh:
                loaded = json.load(fh)
            if isinstance(loaded, dict):
                self._data = loaded
        except (FileNotFoundError, json.JSONDecodeError):
            self._data = {}

    def _flush(self) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(self._data, fh, indent=2)
        os.replace(tmp, self.path)

    def get(self, user_id: str) -> dict:
        with self._lock:
            pref = self._data.get(str(user_id))
            if not pref:
                return {**DEFAULT_PREFERENCE, "user_id": str(user_id)}
            return {**DEFAULT_PREFERENCE, **pref, "user_id": str(user_id)}

    def email_for(self, user_id: str) -> Optional[str]:
        """Return the contact email for a user, or None if unset."""
        pref = self.get(user_id)
        return pref.get("email") or None

    def upsert(self, user_id: str, update: PreferenceUpdate) -> dict:
        with self._lock:
            existing = self._data.get(str(user_id), {})
            merged = {**DEFAULT_PREFERENCE, **existing}
            if update.email:
                merged["email"] = str(update.email)
            merged["frequency"] = update.frequency.value
            merged["notify_new_bounty"] = update.notify_new_bounty
            merged["notify_status_update"] = update.notify_status_update
            merged["notify_payout"] = update.notify_payout
            if update.digest_day:
                merged["digest_day"] = update.digest_day
            merged["updated_at"] = _now_iso()
            self._data[str(user_id)] = merged
            self._flush()
            return {**merged, "user_id": str(user_id)}

    def subscribers_for(self, notification_type: str) -> list[dict]:
        """Return preferences for users who opted into *notification_type*."""
        result = []
        for user_id, pref in self._data.items():
            pref = {**DEFAULT_PREFERENCE, **pref}
            if not pref.get("email"):
                continue
            flag = {
                "new_bounty": "notify_new_bounty",
                "status_update": "notify_status_update",
                "payout": "notify_payout",
            }.get(notification_type)
            if flag and pref.get(flag, True):
                result.append({"user_id": user_id, **pref})
        return result


preference_store = PreferenceStore()
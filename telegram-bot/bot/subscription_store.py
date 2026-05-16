"""Redis-backed subscription store for per-user filter settings."""
import json
import logging
from typing import Optional

import redis

from bot.config import config
from bot.models import UserFilter

logger = logging.getLogger(__name__)


class SubscriptionStore:
    """
    Persists per-user filter settings in Redis.

    Key layout:
      solfoundry:subscriptions:{user_id}  -> JSON UserFilter
      solfoundry:notified:{issue_number}   -> "1" if notified (dedup, 7d TTL)
      solfoundry:last_check                -> ISO timestamp
    """

    SUBSCRIPTIONS_KEY = "solfoundry:subscriptions"
    NOTIFIED_KEY_PREFIX = "solfoundry:notified:"
    LAST_CHECK_KEY = "solfoundry:last_check"

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or config.redis_url
        self._client: Optional[redis.Redis] = None

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def _sub_key(self, user_id: int) -> str:
        return f"{self.SUBSCRIPTIONS_KEY}:{user_id}"

    def get_filter(self, user_id: int) -> UserFilter:
        raw = self.client.get(self._sub_key(user_id))
        if raw:
            try:
                return UserFilter.from_dict(json.loads(raw))
            except (json.JSONDecodeError, KeyError):
                pass
        return UserFilter(user_id=user_id)

    def save_filter(self, user_filter: UserFilter) -> None:
        self.client.set(self._sub_key(user_filter.user_id), json.dumps(user_filter.to_dict()))

    def delete_filter(self, user_id: int) -> None:
        self.client.delete(self._sub_key(user_id))

    def list_subscriptions(self) -> list[UserFilter]:
        keys = self.client.keys(f"{self.SUBSCRIPTIONS_KEY}:*")
        filters = []
        for key in keys:
            raw = self.client.get(key)
            if raw:
                try:
                    filters.append(UserFilter.from_dict(json.loads(raw)))
                except (json.JSONDecodeError, KeyError):
                    pass
        return filters

    def is_notified(self, issue_number: int) -> bool:
        return self.client.exists(f"{self.NOTIFIED_KEY_PREFIX}{issue_number}") > 0

    def mark_notified(self, issue_number: int, ttl: int = 86400 * 7) -> None:
        self.client.setex(f"{self.NOTIFIED_KEY_PREFIX}{issue_number}", ttl, "1")

    def get_last_check(self) -> Optional[str]:
        return self.client.get(self.LAST_CHECK_KEY)

    def set_last_check(self, iso_timestamp: str) -> None:
        self.client.set(self.LAST_CHECK_KEY, iso_timestamp)

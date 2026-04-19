from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from html import escape
from typing import Iterable
from uuid import uuid4


class BountyNotificationEvent(str, Enum):
    POSTED = "posted"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    COMPLETED = "completed"


class NotificationFrequency(str, Enum):
    INSTANT = "instant"
    DAILY_DIGEST = "daily_digest"
    WEEKLY_DIGEST = "weekly_digest"
    DISABLED = "disabled"


class DeliveryStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"
    SUPPRESSED = "suppressed"


@dataclass(frozen=True)
class BountySnapshot:
    id: str
    title: str
    status: str
    reward_amount: int | float
    reward_token: str
    url: str
    skills: tuple[str, ...] = ()
    category: str | None = None


@dataclass(frozen=True)
class BountyEmailTemplate:
    subject: str
    preview: str
    text: str
    html: str


@dataclass
class UserNotificationPreference:
    user_id: str
    email: str
    frequency: NotificationFrequency = NotificationFrequency.INSTANT
    interests: tuple[str, ...] = ()
    events: tuple[BountyNotificationEvent, ...] = (
        BountyNotificationEvent.POSTED,
        BountyNotificationEvent.UPDATED,
        BountyNotificationEvent.STATUS_CHANGED,
        BountyNotificationEvent.COMPLETED,
    )
    enabled: bool = True
    suppressed: bool = False
    bounce_reason: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def accepts(self, event: BountyNotificationEvent, bounty: BountySnapshot) -> bool:
        if not self.enabled or self.suppressed:
            return False
        if self.frequency == NotificationFrequency.DISABLED:
            return False
        if event not in self.events:
            return False
        return interests_match(self.interests, bounty)


@dataclass
class EmailDeliveryRecord:
    id: str
    user_id: str
    email: str
    bounty_id: str
    event: BountyNotificationEvent
    subject: str
    status: DeliveryStatus = DeliveryStatus.QUEUED
    provider_message_id: str | None = None
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    sent_at: datetime | None = None
    bounced_at: datetime | None = None


@dataclass(frozen=True)
class DigestQueueItem:
    user_id: str
    bounty: BountySnapshot
    event: BountyNotificationEvent
    template: BountyEmailTemplate
    queued_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def normalize_event(event: BountyNotificationEvent | str) -> BountyNotificationEvent:
    if isinstance(event, BountyNotificationEvent):
        return event
    return BountyNotificationEvent(event)


def normalize_frequency(frequency: NotificationFrequency | str) -> NotificationFrequency:
    if isinstance(frequency, NotificationFrequency):
        return frequency
    return NotificationFrequency(frequency)


def interests_match(interests: Iterable[str], bounty: BountySnapshot) -> bool:
    normalized = {interest.strip().lower() for interest in interests if interest.strip()}
    if not normalized:
        return True

    searchable = {
        bounty.title.lower(),
        bounty.status.lower(),
        bounty.reward_token.lower(),
        *(skill.lower() for skill in bounty.skills),
    }
    if bounty.category:
        searchable.add(bounty.category.lower())

    return any(
        interest in field_value
        for interest in normalized
        for field_value in searchable
    )


class BountyEmailNotificationService:
    """Coordinates bounty email preferences, templates, delivery state, and bounces."""

    def __init__(self) -> None:
        self.preferences: dict[str, UserNotificationPreference] = {}
        self.deliveries: dict[str, EmailDeliveryRecord] = {}
        self.digest_queue: dict[str, list[DigestQueueItem]] = {}

    def set_preferences(
        self,
        *,
        user_id: str,
        email: str,
        frequency: NotificationFrequency | str = NotificationFrequency.INSTANT,
        interests: Iterable[str] = (),
        events: Iterable[BountyNotificationEvent | str] | None = None,
        enabled: bool = True,
    ) -> UserNotificationPreference:
        if "@" not in email:
            raise ValueError("notification email must contain @")

        normalized_events = tuple(
            normalize_event(event)
            for event in (events or tuple(BountyNotificationEvent))
        )
        preference = UserNotificationPreference(
            user_id=user_id,
            email=email,
            frequency=normalize_frequency(frequency),
            interests=tuple(dict.fromkeys(interest.strip().lower() for interest in interests if interest.strip())),
            events=normalized_events,
            enabled=enabled,
        )
        self.preferences[user_id] = preference
        return preference

    def get_preferences(self, user_id: str) -> UserNotificationPreference | None:
        return self.preferences.get(user_id)

    def build_bounty_update_email(
        self,
        bounty: BountySnapshot,
        event: BountyNotificationEvent | str,
    ) -> BountyEmailTemplate:
        normalized_event = normalize_event(event)
        verb = {
            BountyNotificationEvent.POSTED: "New bounty posted",
            BountyNotificationEvent.UPDATED: "Bounty updated",
            BountyNotificationEvent.STATUS_CHANGED: "Bounty status changed",
            BountyNotificationEvent.COMPLETED: "Bounty completed",
        }[normalized_event]
        reward = f"{bounty.reward_amount:g} {bounty.reward_token}"
        safe_title = escape(bounty.title)
        safe_url = escape(bounty.url, quote=True)
        safe_status = escape(bounty.status)

        text = (
            f"{verb}: {bounty.title}\n"
            f"Status: {bounty.status}\n"
            f"Reward: {reward}\n"
            f"Open: {bounty.url}\n"
        )
        html = (
            f"<h1>{escape(verb)}</h1>"
            f"<p><strong>{safe_title}</strong></p>"
            f"<p>Status: {safe_status}<br>Reward: {escape(reward)}</p>"
            f'<p><a href="{safe_url}">Open bounty</a></p>'
        )
        return BountyEmailTemplate(
            subject=f"{verb}: {bounty.title}",
            preview=f"{bounty.title} is {bounty.status} with {reward} available.",
            text=text,
            html=html,
        )

    def enqueue_bounty_event(
        self,
        bounty: BountySnapshot,
        event: BountyNotificationEvent | str,
    ) -> list[EmailDeliveryRecord]:
        normalized_event = normalize_event(event)
        queued_deliveries: list[EmailDeliveryRecord] = []

        for preference in self.preferences.values():
            if not preference.accepts(normalized_event, bounty):
                continue

            template = self.build_bounty_update_email(bounty, normalized_event)
            if preference.frequency == NotificationFrequency.INSTANT:
                delivery = EmailDeliveryRecord(
                    id=str(uuid4()),
                    user_id=preference.user_id,
                    email=preference.email,
                    bounty_id=bounty.id,
                    event=normalized_event,
                    subject=template.subject,
                )
                self.deliveries[delivery.id] = delivery
                queued_deliveries.append(delivery)
            else:
                self.digest_queue.setdefault(preference.user_id, []).append(
                    DigestQueueItem(
                        user_id=preference.user_id,
                        bounty=bounty,
                        event=normalized_event,
                        template=template,
                    )
                )

        return queued_deliveries

    def mark_sent(self, delivery_id: str, provider_message_id: str | None = None) -> EmailDeliveryRecord:
        delivery = self._delivery(delivery_id)
        delivery.status = DeliveryStatus.SENT
        delivery.provider_message_id = provider_message_id
        delivery.sent_at = datetime.now(timezone.utc)
        delivery.error = None
        return delivery

    def mark_failed(self, delivery_id: str, error: str) -> EmailDeliveryRecord:
        delivery = self._delivery(delivery_id)
        delivery.status = DeliveryStatus.FAILED
        delivery.error = error
        return delivery

    def record_bounce(self, delivery_id: str, reason: str) -> EmailDeliveryRecord:
        delivery = self._delivery(delivery_id)
        delivery.status = DeliveryStatus.BOUNCED
        delivery.error = reason
        delivery.bounced_at = datetime.now(timezone.utc)

        preference = self.preferences.get(delivery.user_id)
        if preference:
            preference.suppressed = True
            preference.bounce_reason = reason
            preference.updated_at = datetime.now(timezone.utc)

        return delivery

    def pending_digest(self, user_id: str) -> list[DigestQueueItem]:
        return list(self.digest_queue.get(user_id, []))

    def consume_digest(self, user_id: str) -> list[DigestQueueItem]:
        return self.digest_queue.pop(user_id, [])

    def _delivery(self, delivery_id: str) -> EmailDeliveryRecord:
        try:
            return self.deliveries[delivery_id]
        except KeyError as exc:
            raise KeyError(f"unknown delivery id: {delivery_id}") from exc

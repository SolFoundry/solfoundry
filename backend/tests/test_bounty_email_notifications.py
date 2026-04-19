import unittest

from app.services.bounty_email_notifications import (
    BountyEmailNotificationService,
    BountyNotificationEvent,
    BountySnapshot,
    DeliveryStatus,
    NotificationFrequency,
)


def bounty(**overrides):
    data = {
        "id": "bounty-1",
        "title": "Add Rust SDK examples",
        "status": "open",
        "reward_amount": 400_000,
        "reward_token": "FNDRY",
        "url": "https://github.com/SolFoundry/solfoundry/issues/841",
        "skills": ("rust", "sdk"),
        "category": "backend",
    }
    data.update(overrides)
    return BountySnapshot(**data)


class BountyEmailNotificationServiceTest(unittest.TestCase):
    def test_instant_notification_queues_delivery_with_template(self):
        service = BountyEmailNotificationService()
        service.set_preferences(
            user_id="user-1",
            email="builder@example.com",
            frequency=NotificationFrequency.INSTANT,
            interests=("rust",),
        )

        deliveries = service.enqueue_bounty_event(bounty(), BountyNotificationEvent.POSTED)

        self.assertEqual(len(deliveries), 1)
        self.assertEqual(deliveries[0].status, DeliveryStatus.QUEUED)
        self.assertIn("New bounty posted", deliveries[0].subject)
        self.assertEqual(deliveries[0].email, "builder@example.com")

    def test_interest_and_event_preferences_filter_recipients(self):
        service = BountyEmailNotificationService()
        service.set_preferences(
            user_id="rust-user",
            email="rust@example.com",
            interests=("rust",),
            events=(BountyNotificationEvent.UPDATED,),
        )
        service.set_preferences(
            user_id="design-user",
            email="design@example.com",
            interests=("design",),
            events=(BountyNotificationEvent.UPDATED,),
        )

        posted = service.enqueue_bounty_event(bounty(), BountyNotificationEvent.POSTED)
        updated = service.enqueue_bounty_event(bounty(), BountyNotificationEvent.UPDATED)

        self.assertEqual(posted, [])
        self.assertEqual(len(updated), 1)
        self.assertEqual(updated[0].user_id, "rust-user")

    def test_digest_preferences_collect_without_immediate_delivery(self):
        service = BountyEmailNotificationService()
        service.set_preferences(
            user_id="digest-user",
            email="digest@example.com",
            frequency=NotificationFrequency.DAILY_DIGEST,
            interests=("backend",),
        )

        deliveries = service.enqueue_bounty_event(bounty(), BountyNotificationEvent.STATUS_CHANGED)
        pending = service.pending_digest("digest-user")

        self.assertEqual(deliveries, [])
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0].event, BountyNotificationEvent.STATUS_CHANGED)
        self.assertEqual(service.consume_digest("digest-user"), pending)
        self.assertEqual(service.pending_digest("digest-user"), [])

    def test_delivery_tracking_and_bounce_suppression(self):
        service = BountyEmailNotificationService()
        service.set_preferences(user_id="user-1", email="builder@example.com")
        delivery = service.enqueue_bounty_event(bounty(), BountyNotificationEvent.COMPLETED)[0]

        sent = service.mark_sent(delivery.id, "provider-123")
        self.assertEqual(sent.status, DeliveryStatus.SENT)
        self.assertEqual(sent.provider_message_id, "provider-123")

        bounced = service.record_bounce(delivery.id, "hard bounce")
        preference = service.get_preferences("user-1")

        self.assertEqual(bounced.status, DeliveryStatus.BOUNCED)
        self.assertTrue(preference.suppressed)
        self.assertEqual(
            service.enqueue_bounty_event(bounty(id="bounty-2"), BountyNotificationEvent.POSTED),
            [],
        )


if __name__ == "__main__":
    unittest.main()

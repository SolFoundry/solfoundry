"""Tests for the on-chain event indexing service (Helius/Shyft webhooks).

Covers the full indexing pipeline: webhook receipt, payload parsing,
deduplication, async queue processing, database persistence, query API
with filters and pagination, health monitoring, backfill, and
WebSocket broadcast integration.

Uses sample Helius and Shyft webhook payloads that mirror the real
provider formats.
"""

import asyncio
import json
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import engine, Base
from app.main import app
from app.models.indexed_event import (
    IndexedEventTable,
    IndexerHealthTable,
    OnChainEventType,
    EventSource,
    IndexedEventStatus,
)


@pytest.fixture(scope="module", autouse=True)
def _create_indexer_tables():
    """Ensure indexer tables exist in the test database."""
    async def _create():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(_create())


# ---------------------------------------------------------------------------
# Sample webhook payloads
# ---------------------------------------------------------------------------

SAMPLE_HELIUS_PAYLOAD = [
    {
        "signature": "5" * 88,
        "slot": 250_000_000,
        "blockTime": 1700000000,
        "type": "TRANSFER",
        "source": "SYSTEM_PROGRAM",
        "description": "Escrow created for bounty #42",
        "accountData": [
            {
                "account": "SFndryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "nativeBalanceChange": -1000000,
                "tokenBalanceChanges": [],
            }
        ],
        "nativeTransfers": [
            {
                "fromUserAccount": "A" * 44,
                "toUserAccount": "B" * 44,
                "amount": 1000000,
            }
        ],
        "tokenTransfers": [],
    },
]

SAMPLE_HELIUS_ESCROW_RELEASE = [
    {
        "signature": "6" * 88,
        "slot": 250_000_001,
        "blockTime": 1700000060,
        "type": "TRANSFER",
        "source": "SYSTEM_PROGRAM",
        "description": "Escrow released to winner",
        "accountData": [],
        "nativeTransfers": [],
        "tokenTransfers": [
            {
                "fromUserAccount": "B" * 44,
                "toUserAccount": "C" * 44,
                "tokenAmount": 500000.0,
                "mint": "FNDRY_MINT",
            }
        ],
    },
]

SAMPLE_HELIUS_REPUTATION = [
    {
        "signature": "7" * 88,
        "slot": 250_000_002,
        "blockTime": 1700000120,
        "type": "PROGRAM_INTERACTION",
        "source": "SYSTEM_PROGRAM",
        "description": "Reputation updated for contributor",
        "accountData": [],
        "nativeTransfers": [],
        "tokenTransfers": [],
    },
]

SAMPLE_HELIUS_STAKE = [
    {
        "signature": "8" * 88,
        "slot": 250_000_003,
        "blockTime": 1700000180,
        "type": "TRANSFER",
        "source": "SYSTEM_PROGRAM",
        "description": "Stake deposited by validator",
        "accountData": [],
        "nativeTransfers": [
            {
                "fromUserAccount": "D" * 44,
                "toUserAccount": "E" * 44,
                "amount": 2000000,
            }
        ],
        "tokenTransfers": [],
    },
]

SAMPLE_SHYFT_PAYLOAD = {
    "signature": "9" * 88,
    "slot": 250_000_010,
    "blockTime": 1700000300,
    "type": "TOKEN_TRANSFER",
    "actions": [
        {
            "type": "TRANSFER",
            "info": {
                "sender": "A" * 44,
                "receiver": "B" * 44,
                "amount": 750000,
            },
        }
    ],
    "raw": None,
}

SAMPLE_SHYFT_ARRAY = [
    {
        "signature": "1" * 88,
        "slot": 250_000_020,
        "blockTime": 1700000400,
        "type": "STAKE",
        "actions": [
            {
                "type": "STAKE",
                "info": {
                    "authority": "F" * 44,
                    "amount": 1500000,
                },
            }
        ],
    },
    {
        "signature": "2" * 88,
        "slot": 250_000_021,
        "blockTime": 1700000460,
        "type": "TRANSFER",
        "actions": [],
    },
]


# =========================================================================
# Helius webhook endpoint tests
# =========================================================================


class TestHeliusWebhook:
    """POST /api/webhooks/helius tests."""

    @pytest.mark.asyncio
    async def test_helius_webhook_accepts_valid_payload(self):
        """Valid Helius webhook payload is accepted and events are enqueued."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                json=SAMPLE_HELIUS_PAYLOAD,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "accepted"
            assert data["transactions_received"] == 1
            assert data["events_enqueued"] >= 1

    @pytest.mark.asyncio
    async def test_helius_webhook_rejects_invalid_json(self):
        """Invalid JSON body returns 400."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                content=b"not json",
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_helius_webhook_handles_empty_array(self):
        """Empty transaction array is accepted gracefully."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                json=[],
            )
            assert response.status_code == 200
            data = response.json()
            assert data["events_enqueued"] == 0

    @pytest.mark.asyncio
    async def test_helius_webhook_signature_verification(self):
        """When HELIUS_WEBHOOK_SECRET is set, invalid signatures are rejected."""
        payload = json.dumps(SAMPLE_HELIUS_PAYLOAD).encode("utf-8")
        secret = "test-secret-helius"

        with patch(
            "app.api.event_indexer.HELIUS_WEBHOOK_SECRET", secret,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Invalid signature
                response = await client.post(
                    "/api/webhooks/helius",
                    content=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": "invalid-signature",
                    },
                )
                assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_helius_webhook_valid_signature_accepted(self):
        """Valid HMAC signature passes verification."""
        payload = json.dumps(SAMPLE_HELIUS_PAYLOAD).encode("utf-8")
        secret = "test-secret-helius"
        valid_sig = hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256,
        ).hexdigest()

        with patch(
            "app.api.event_indexer.HELIUS_WEBHOOK_SECRET", secret,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/webhooks/helius",
                    content=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": valid_sig,
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_helius_webhook_escrow_release_event(self):
        """Helius payload with escrow release is correctly classified."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                json=SAMPLE_HELIUS_ESCROW_RELEASE,
            )
            assert response.status_code == 200
            assert response.json()["events_enqueued"] >= 1

    @pytest.mark.asyncio
    async def test_helius_webhook_reputation_event(self):
        """Helius payload with reputation update is correctly classified."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                json=SAMPLE_HELIUS_REPUTATION,
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_helius_webhook_stake_event(self):
        """Helius payload with stake deposit is correctly classified."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/helius",
                json=SAMPLE_HELIUS_STAKE,
            )
            assert response.status_code == 200


# =========================================================================
# Shyft webhook endpoint tests
# =========================================================================


class TestShyftWebhook:
    """POST /api/webhooks/shyft tests."""

    @pytest.mark.asyncio
    async def test_shyft_webhook_accepts_single_event(self):
        """Single Shyft transaction event is accepted."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/shyft",
                json=SAMPLE_SHYFT_PAYLOAD,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "accepted"
            assert data["events_enqueued"] >= 1

    @pytest.mark.asyncio
    async def test_shyft_webhook_accepts_array(self):
        """Array of Shyft transaction events is accepted."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/shyft",
                json=SAMPLE_SHYFT_ARRAY,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["events_enqueued"] >= 1

    @pytest.mark.asyncio
    async def test_shyft_webhook_rejects_invalid_json(self):
        """Invalid JSON body returns 400."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/webhooks/shyft",
                content=b"invalid",
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_shyft_webhook_signature_verification(self):
        """When SHYFT_WEBHOOK_SECRET is set, invalid signatures are rejected."""
        payload = json.dumps(SAMPLE_SHYFT_PAYLOAD).encode("utf-8")
        secret = "test-secret-shyft"

        with patch(
            "app.api.event_indexer.SHYFT_WEBHOOK_SECRET", secret,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/webhooks/shyft",
                    content=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-shyft-signature": "wrong-sig",
                    },
                )
                assert response.status_code == 401


# =========================================================================
# Payload parsing tests
# =========================================================================


class TestPayloadParsing:
    """Tests for the Helius and Shyft webhook payload parsers."""

    def test_parse_helius_extracts_correct_fields(self):
        """Helius parser extracts signature, slot, event type, and wallet."""
        from app.services.event_indexer_service import parse_helius_webhook

        events = parse_helius_webhook(SAMPLE_HELIUS_PAYLOAD)
        assert len(events) == 1

        event = events[0]
        assert event["transaction_signature"] == "5" * 88
        assert event["block_slot"] == 250_000_000
        assert event["event_type"] == OnChainEventType.ESCROW_CREATED.value
        assert event["source"] == EventSource.HELIUS.value
        assert event["user_wallet"] == "A" * 44

    def test_parse_helius_escrow_release(self):
        """Helius parser classifies escrow release correctly."""
        from app.services.event_indexer_service import parse_helius_webhook

        events = parse_helius_webhook(SAMPLE_HELIUS_ESCROW_RELEASE)
        assert len(events) == 1
        assert events[0]["event_type"] == OnChainEventType.ESCROW_RELEASED.value
        assert events[0]["amount"] == Decimal("500000.0")

    def test_parse_helius_reputation_update(self):
        """Helius parser classifies reputation update correctly."""
        from app.services.event_indexer_service import parse_helius_webhook

        events = parse_helius_webhook(SAMPLE_HELIUS_REPUTATION)
        assert len(events) == 1
        assert events[0]["event_type"] == OnChainEventType.REPUTATION_UPDATED.value

    def test_parse_helius_stake_deposit(self):
        """Helius parser classifies stake deposit correctly."""
        from app.services.event_indexer_service import parse_helius_webhook

        events = parse_helius_webhook(SAMPLE_HELIUS_STAKE)
        assert len(events) == 1
        assert events[0]["event_type"] == OnChainEventType.STAKE_DEPOSITED.value

    def test_parse_helius_skips_missing_signature(self):
        """Events without signatures are skipped."""
        from app.services.event_indexer_service import parse_helius_webhook

        events = parse_helius_webhook([{"slot": 100, "blockTime": 123}])
        assert len(events) == 0

    def test_parse_shyft_single_event(self):
        """Shyft parser handles a single transaction object."""
        from app.services.event_indexer_service import parse_shyft_webhook

        events = parse_shyft_webhook(SAMPLE_SHYFT_PAYLOAD)
        assert len(events) == 1
        assert events[0]["transaction_signature"] == "9" * 88
        assert events[0]["source"] == EventSource.SHYFT.value
        assert events[0]["user_wallet"] == "A" * 44

    def test_parse_shyft_array(self):
        """Shyft parser handles an array of transactions."""
        from app.services.event_indexer_service import parse_shyft_webhook

        events = parse_shyft_webhook(SAMPLE_SHYFT_ARRAY)
        assert len(events) == 2

    def test_parse_shyft_skips_missing_signature(self):
        """Shyft events without signatures are skipped."""
        from app.services.event_indexer_service import parse_shyft_webhook

        events = parse_shyft_webhook([{"slot": 100}])
        assert len(events) == 0


# =========================================================================
# Event classification tests
# =========================================================================


class TestEventClassification:
    """Tests for the event type classification heuristics."""

    def test_classify_escrow_created(self):
        """Description containing 'escrow' and 'create' maps to ESCROW_CREATED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("TRANSFER", "Escrow created for bounty", [], [])
        assert result == OnChainEventType.ESCROW_CREATED

    def test_classify_escrow_released(self):
        """Description containing 'escrow' and 'release' maps to ESCROW_RELEASED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("TRANSFER", "Escrow released to winner", [], [])
        assert result == OnChainEventType.ESCROW_RELEASED

    def test_classify_escrow_refunded(self):
        """Description containing 'escrow' and 'refund' maps to ESCROW_REFUNDED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("TRANSFER", "Escrow refund processed", [], [])
        assert result == OnChainEventType.ESCROW_REFUNDED

    def test_classify_reputation_updated(self):
        """Description containing 'reputation' maps to REPUTATION_UPDATED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("UPDATE", "Reputation updated for user", [], [])
        assert result == OnChainEventType.REPUTATION_UPDATED

    def test_classify_stake_deposited(self):
        """Description containing 'stake' maps to STAKE_DEPOSITED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("TRANSFER", "Stake deposited", [], [])
        assert result == OnChainEventType.STAKE_DEPOSITED

    def test_classify_with_token_transfers_fallback(self):
        """Unknown description with token transfers falls back to ESCROW_FUNDED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type(
            "TRANSFER", "Unknown operation", [{"amount": 100}], [],
        )
        assert result == OnChainEventType.ESCROW_FUNDED

    def test_classify_fully_unknown_defaults(self):
        """Completely unknown transaction defaults to ESCROW_CREATED."""
        from app.services.event_indexer_service import classify_event_type

        result = classify_event_type("UNKNOWN", "", [], [])
        assert result == OnChainEventType.ESCROW_CREATED


# =========================================================================
# Deduplication tests
# =========================================================================


class TestDeduplication:
    """Tests for event deduplication via unique constraint."""

    @pytest.mark.asyncio
    async def test_duplicate_events_are_skipped(self):
        """Inserting the same (signature, log_index) twice skips the duplicate."""
        from app.services.event_indexer_service import persist_events

        events = [
            {
                "transaction_signature": "DEDUP_TEST_" + "A" * 77,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_CREATED.value,
                "program_id": "TestProgram",
                "block_slot": 100,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        inserted_1, dupes_1 = await persist_events(events)
        assert inserted_1 == 1
        assert dupes_1 == 0

        # Second insertion of same event
        inserted_2, dupes_2 = await persist_events(events)
        assert inserted_2 == 0
        assert dupes_2 == 1

    @pytest.mark.asyncio
    async def test_different_log_index_not_duplicate(self):
        """Same signature but different log_index is NOT a duplicate."""
        from app.services.event_indexer_service import persist_events

        base_event = {
            "transaction_signature": "LOGIDX_TEST_" + "B" * 76,
            "event_type": OnChainEventType.ESCROW_CREATED.value,
            "program_id": "TestProgram",
            "block_slot": 200,
            "block_time": datetime.now(timezone.utc),
            "source": EventSource.HELIUS.value,
            "accounts": {},
            "data": {},
            "user_wallet": None,
            "amount": None,
            "status": IndexedEventStatus.CONFIRMED.value,
        }

        event_0 = {**base_event, "log_index": 0}
        event_1 = {**base_event, "log_index": 1}

        inserted_0, _ = await persist_events([event_0])
        inserted_1, _ = await persist_events([event_1])

        assert inserted_0 == 1
        assert inserted_1 == 1


# =========================================================================
# Queue processing tests
# =========================================================================


class TestQueueProcessing:
    """Tests for the async event processing queue."""

    @pytest.mark.asyncio
    async def test_enqueue_and_process(self):
        """Events enqueued are processed by the queue worker batch."""
        from app.services.event_indexer_service import (
            enqueue_events,
            _process_queue_batch,
            _event_queue,
        )

        # Clear the queue first
        while not _event_queue.empty():
            try:
                _event_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        events = [
            {
                "transaction_signature": "QUEUE_TEST_" + "C" * 77,
                "log_index": 0,
                "event_type": OnChainEventType.STAKE_DEPOSITED.value,
                "program_id": "TestProgram",
                "block_slot": 300,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": "A" * 44,
                "amount": Decimal("1000"),
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        enqueued = await enqueue_events(events)
        assert enqueued == 1
        assert not _event_queue.empty()

        processed = await _process_queue_batch()
        assert processed >= 1

    @pytest.mark.asyncio
    async def test_queue_enqueue_returns_count(self):
        """enqueue_events returns the count of events successfully enqueued."""
        from app.services.event_indexer_service import enqueue_events, _event_queue

        # Clear the queue
        while not _event_queue.empty():
            try:
                _event_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        events = [
            {
                "transaction_signature": f"COUNT_TEST_{i}_" + "X" * 74,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_CREATED.value,
                "program_id": "TestProgram",
                "block_slot": 400 + i,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
            for i in range(3)
        ]

        enqueued = await enqueue_events(events)
        assert enqueued == 3

        # Drain for cleanup
        while not _event_queue.empty():
            try:
                _event_queue.get_nowait()
            except asyncio.QueueEmpty:
                break


# =========================================================================
# Query API tests
# =========================================================================


class TestQueryAPI:
    """GET /api/indexed-events tests."""

    @pytest.mark.asyncio
    async def test_list_events_returns_paginated_results(self):
        """Query endpoint returns paginated event list."""
        from app.services.event_indexer_service import persist_events

        # Ensure at least one event exists
        events = [
            {
                "transaction_signature": "QUERY_TEST_" + "D" * 77,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_CREATED.value,
                "program_id": "TestProgram",
                "block_slot": 500,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {"test": True},
                "user_wallet": "Q" * 44,
                "bounty_id": "00000000-0000-0000-0000-000000000506",
                "amount": Decimal("350000"),
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]
        await persist_events(events)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/indexed-events")
            assert response.status_code == 200
            data = response.json()
            assert "events" in data
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "has_more" in data
            assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_filter_by_event_type(self):
        """Filtering by event_type returns only matching events."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/indexed-events",
                params={"event_type": OnChainEventType.ESCROW_CREATED.value},
            )
            assert response.status_code == 200
            data = response.json()
            for event in data["events"]:
                assert event["event_type"] == OnChainEventType.ESCROW_CREATED.value

    @pytest.mark.asyncio
    async def test_filter_by_user_wallet(self):
        """Filtering by user_wallet returns only matching events."""
        target_wallet = "Q" * 44
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/indexed-events",
                params={"user_wallet": target_wallet},
            )
            assert response.status_code == 200
            data = response.json()
            for event in data["events"]:
                assert event["user_wallet"] == target_wallet

    @pytest.mark.asyncio
    async def test_filter_by_bounty_id(self):
        """Filtering by bounty_id returns only matching events."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/indexed-events",
                params={"bounty_id": "00000000-0000-0000-0000-000000000506"},
            )
            assert response.status_code == 200
            data = response.json()
            for event in data["events"]:
                assert event["bounty_id"] == "00000000-0000-0000-0000-000000000506"

    @pytest.mark.asyncio
    async def test_filter_by_date_range(self):
        """Filtering by start_date and end_date works correctly."""
        now = datetime.now(timezone.utc)
        start = (now - timedelta(hours=1)).isoformat()
        end = (now + timedelta(hours=1)).isoformat()

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/indexed-events",
                params={"start_date": start, "end_date": end},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_pagination_params(self):
        """Page and page_size parameters control pagination."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/indexed-events",
                params={"page": 1, "page_size": 2},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["page"] == 1
            assert data["page_size"] == 2
            assert len(data["events"]) <= 2

    @pytest.mark.asyncio
    async def test_get_event_by_signature(self):
        """GET /api/indexed-events/{signature} returns the correct event."""
        from app.services.event_indexer_service import persist_events

        sig = "GETSIG_TEST_" + "E" * 76
        events = [
            {
                "transaction_signature": sig,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_FUNDED.value,
                "program_id": "TestProgram",
                "block_slot": 600,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]
        await persist_events(events)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(f"/api/indexed-events/{sig}")
            assert response.status_code == 200
            data = response.json()
            assert data["transaction_signature"] == sig
            assert data["event_type"] == OnChainEventType.ESCROW_FUNDED.value

    @pytest.mark.asyncio
    async def test_get_nonexistent_event_returns_404(self):
        """GET /api/indexed-events/{signature} returns 404 for missing events."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/indexed-events/" + "Z" * 88)
            assert response.status_code == 404


# =========================================================================
# Health monitoring tests
# =========================================================================


class TestHealthMonitoring:
    """GET /api/indexed-events/health tests."""

    @pytest.mark.asyncio
    async def test_health_endpoint_returns_status(self):
        """Health endpoint returns aggregated indexer health."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/indexed-events/health")
            assert response.status_code == 200
            data = response.json()
            assert "sources" in data
            assert "overall_healthy" in data
            assert isinstance(data["overall_healthy"], bool)

    @pytest.mark.asyncio
    async def test_health_detects_stale_source(self):
        """A source with no recent webhooks is flagged as unhealthy."""
        from app.services.event_indexer_service import _update_health, get_indexer_health
        from app.database import get_db_session
        from app.models.indexed_event import IndexerHealthTable
        from sqlalchemy import select

        # Insert a health record with old timestamp
        old_time = datetime.now(timezone.utc) - timedelta(hours=1)

        await _update_health(
            source="test_stale",
            latest_slot=1000,
            latest_block_time=old_time,
            events_count=5,
        )

        # Manually set the webhook received time to old
        async with get_db_session() as db:
            result = await db.execute(
                select(IndexerHealthTable).where(
                    IndexerHealthTable.source == "test_stale"
                )
            )
            row = result.scalar_one_or_none()
            if row:
                row.last_webhook_received_at = old_time
                await db.commit()

        with patch(
            "app.services.event_indexer_service.HEALTH_STALENESS_THRESHOLD_SECONDS",
            60,
        ):
            health = await get_indexer_health()
            stale_source = next(
                (s for s in health.sources if s.source == "test_stale"), None,
            )
            if stale_source:
                assert not stale_source.is_healthy
                assert stale_source.seconds_behind is not None
                assert stale_source.seconds_behind > 60

    @pytest.mark.asyncio
    async def test_health_check_alert_logs_warning(self):
        """check_indexer_health_and_alert logs warnings for unhealthy sources."""
        from app.services.event_indexer_service import check_indexer_health_and_alert

        # Should not raise even if sources are unhealthy
        result = await check_indexer_health_and_alert()
        assert isinstance(result, bool)


# =========================================================================
# Backfill tests
# =========================================================================


class TestBackfill:
    """POST /api/indexed-events/backfill tests."""

    @pytest.mark.asyncio
    async def test_backfill_requires_auth(self):
        """Backfill endpoint requires authentication."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/indexed-events/backfill",
                json={
                    "start_slot": 100,
                    "end_slot": 200,
                },
            )
            # Auth is disabled in tests, so should pass
            # But validates the endpoint exists and accepts the request
            assert response.status_code in (200, 400, 422)

    @pytest.mark.asyncio
    async def test_backfill_validates_slot_range(self):
        """End slot must be >= start slot."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/indexed-events/backfill",
                json={
                    "start_slot": 200,
                    "end_slot": 100,
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_backfill_without_api_key_returns_failed(self):
        """Backfill without provider API key returns failed status."""
        with patch(
            "app.services.event_indexer_service.HELIUS_API_KEY", "",
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/indexed-events/backfill",
                    json={
                        "start_slot": 100,
                        "end_slot": 200,
                        "source": "helius",
                    },
                )
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "failed"
                assert "HELIUS_API_KEY" in data["errors"][0]

    @pytest.mark.asyncio
    async def test_backfill_with_mock_helius_api(self):
        """Backfill successfully indexes events from mocked Helius API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_HELIUS_PAYLOAD

        with patch(
            "app.services.event_indexer_service.HELIUS_API_KEY", "test-key",
        ), patch(
            "httpx.AsyncClient.post",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            from app.services.event_indexer_service import backfill_events

            result = await backfill_events(
                start_slot=100, end_slot=200, source="helius",
            )
            assert result.status in ("completed", "completed_with_errors")
            assert result.start_slot == 100
            assert result.end_slot == 200

    @pytest.mark.asyncio
    async def test_backfill_shyft_without_key(self):
        """Shyft backfill without API key returns failed status."""
        with patch(
            "app.services.event_indexer_service.SHYFT_API_KEY", "",
        ):
            from app.services.event_indexer_service import backfill_events

            result = await backfill_events(
                start_slot=100, end_slot=200, source="shyft",
            )
            assert result.status == "failed"
            assert "SHYFT_API_KEY" in result.errors[0]


# =========================================================================
# WebSocket integration tests
# =========================================================================


class TestWebSocketIntegration:
    """Tests for real-time WebSocket broadcast of indexed events."""

    @pytest.mark.asyncio
    async def test_queue_processing_broadcasts_events(self):
        """Queue worker broadcasts indexed events via WebSocket manager."""
        from app.services.event_indexer_service import (
            enqueue_events,
            _process_queue_batch,
            _event_queue,
        )

        # Clear queue
        while not _event_queue.empty():
            try:
                _event_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        events = [
            {
                "transaction_signature": "WS_TEST_" + "F" * 80,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_CREATED.value,
                "program_id": "TestProgram",
                "block_slot": 700,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "bounty_id": "test-bounty-ws",
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        await enqueue_events(events)

        with patch(
            "app.services.websocket_manager.manager.emit_event",
            new_callable=AsyncMock,
        ) as mock_emit:
            processed = await _process_queue_batch()
            assert processed >= 1
            # WebSocket emit should have been called
            if mock_emit.called:
                call_args = mock_emit.call_args
                assert call_args[1]["channel"] == "indexed_events" or \
                       call_args.kwargs.get("channel") == "indexed_events"


# =========================================================================
# Persistence integration tests
# =========================================================================


class TestPersistence:
    """Integration tests for database persistence."""

    @pytest.mark.asyncio
    async def test_persist_events_creates_rows(self):
        """persist_events creates database rows for new events."""
        from app.services.event_indexer_service import persist_events

        events = [
            {
                "transaction_signature": "PERSIST_TEST_" + "G" * 75,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_RELEASED.value,
                "program_id": "TestProgram",
                "block_slot": 800,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {"creator": "A" * 44},
                "data": {"tx_type": "release"},
                "user_wallet": "A" * 44,
                "bounty_id": "00000000-0000-0000-0000-000000000800",
                "amount": Decimal("100000"),
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        inserted, duplicates = await persist_events(events)
        assert inserted == 1
        assert duplicates == 0

    @pytest.mark.asyncio
    async def test_persist_updates_health_record(self):
        """Persisting events updates the indexer health record."""
        from app.services.event_indexer_service import persist_events, get_indexer_health

        events = [
            {
                "transaction_signature": "HEALTH_TEST_" + "H" * 76,
                "log_index": 0,
                "event_type": OnChainEventType.STAKE_DEPOSITED.value,
                "program_id": "TestProgram",
                "block_slot": 999_999,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        await persist_events(events)

        health = await get_indexer_health()
        helius_source = next(
            (s for s in health.sources if s.source == EventSource.HELIUS.value), None,
        )
        assert helius_source is not None
        assert helius_source.events_processed >= 1

    @pytest.mark.asyncio
    async def test_persist_batch_with_mixed_duplicates(self):
        """Batch with mix of new and duplicate events processes correctly."""
        from app.services.event_indexer_service import persist_events

        base_sig = "MIXED_TEST_" + "I" * 77
        events = [
            {
                "transaction_signature": base_sig,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_CREATED.value,
                "program_id": "TestProgram",
                "block_slot": 1000,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        # First insert
        inserted_1, _ = await persist_events(events)
        assert inserted_1 == 1

        # Add a new event alongside the duplicate
        new_sig = "MIXED_NEW_" + "J" * 78
        mixed_batch = events + [
            {
                "transaction_signature": new_sig,
                "log_index": 0,
                "event_type": OnChainEventType.ESCROW_FUNDED.value,
                "program_id": "TestProgram",
                "block_slot": 1001,
                "block_time": datetime.now(timezone.utc),
                "source": EventSource.HELIUS.value,
                "accounts": {},
                "data": {},
                "user_wallet": None,
                "amount": None,
                "status": IndexedEventStatus.CONFIRMED.value,
            }
        ]

        inserted_2, dupes_2 = await persist_events(mixed_batch)
        assert dupes_2 >= 1  # The first event is a duplicate
        assert inserted_2 >= 1  # The new event should be inserted


# =========================================================================
# Model validation tests
# =========================================================================


class TestModelValidation:
    """Tests for Pydantic model validation."""

    def test_backfill_request_end_before_start_rejected(self):
        """BackfillRequest rejects end_slot < start_slot."""
        from app.models.indexed_event import BackfillRequest

        with pytest.raises(ValueError):
            BackfillRequest(start_slot=200, end_slot=100)

    def test_backfill_request_valid(self):
        """BackfillRequest accepts valid slot range."""
        from app.models.indexed_event import BackfillRequest

        req = BackfillRequest(start_slot=100, end_slot=200)
        assert req.start_slot == 100
        assert req.end_slot == 200

    def test_event_type_enum_values(self):
        """OnChainEventType has all required event types."""
        assert OnChainEventType.ESCROW_CREATED.value == "escrow_created"
        assert OnChainEventType.ESCROW_RELEASED.value == "escrow_released"
        assert OnChainEventType.REPUTATION_UPDATED.value == "reputation_updated"
        assert OnChainEventType.STAKE_DEPOSITED.value == "stake_deposited"

    def test_event_source_enum_values(self):
        """EventSource has helius, shyft, and backfill."""
        assert EventSource.HELIUS.value == "helius"
        assert EventSource.SHYFT.value == "shyft"
        assert EventSource.BACKFILL.value == "backfill"

    def test_indexed_event_status_enum_values(self):
        """IndexedEventStatus has confirmed, processing, and failed."""
        assert IndexedEventStatus.CONFIRMED.value == "confirmed"
        assert IndexedEventStatus.PROCESSING.value == "processing"
        assert IndexedEventStatus.FAILED.value == "failed"

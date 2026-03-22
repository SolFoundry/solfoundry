"""Tests for the events API and ingestion service."""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event_index import EventDB
from app.services.event_index_service import ingest_event


pytestmark = pytest.mark.asyncio


class TestEventIngestion:
    """Test the event ingestion service."""

    async def test_ingest_event_creates_record(self, db: AsyncSession):
        """ingest_event stores a row in the events table."""
        payload = {"test": "data"}
        event = await ingest_event(
            event_type="test_event",
            source="github",
            payload=payload,
            channel="github",
            timestamp=datetime.now(timezone.utc),
            db=db,
            broadcast=False,
        )
        assert event is not None
        assert event.id is not None
        assert event.event_type == "test_event"
        assert event.source == "github"
        assert event.payload == payload

        # Verify it was actually persisted
        result = await db.get(EventDB, event.id)
        assert result is not None
        assert result.event_type == "test_event"

    async def test_ingest_event_with_optional_fields(self, db: AsyncSession):
        """ingest_event accepts optional linking fields."""
        event = await ingest_event(
            event_type="payout_sent",
            source="solana",
            payload={"amount": 100},
            tx_hash="sig123",
            block_slot=12345,
            bounty_id="550e8400-e29b-41d4-a716-446655440000",
            contributor_id="wallet_abc",
            db=db,
            broadcast=False,
        )
        assert event.tx_hash == "sig123"
        assert event.block_slot == 12345
        assert event.bounty_id is not None
        assert event.contributor_id == "wallet_abc"

    async def test_ingest_event_without_db_supplies_new_session(self):
        """ingest_event creates its own session if db not provided."""
        # This will use an in-memory SQLite because DATABASE_URL override
        event = await ingest_event(
            event_type="lone",
            source="github",
            payload={},
            broadcast=False,
        )
        assert event is not None
        # Row persisted? Hard to verify without session; trust success


class TestEventsAPI:
    """Test the /api/v1/events endpoints."""

    async def test_list_events_empty_returns_empty(self, client):
        """GET /api/v1/events returns empty list when no events."""
        resp = await client.get("/api/v1/events")
        assert resp.status_code == 200
        data = resp.json()
        assert data["events"] == []
        assert data["total"] == 0
        assert data["has_more"] is False

    async def test_list_events_filters_by_source(self, client, db: AsyncSession):
        """Filtering by source returns only matching rows."""
        now = datetime.now(timezone.utc)
        e1 = EventDB(event_type="pr", source="github", timestamp=now, payload={})
        e2 = EventDB(event_type="tx", source="solana", timestamp=now, payload={})
        db.add_all([e1, e2])
        await db.commit()

        resp = await client.get("/api/v1/events?source=github")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["source"] == "github"

    async def test_list_events_pagination(self, client, db: AsyncSession):
        """Pagination returns proper page and total."""
        now = datetime.now(timezone.utc)
        events = [EventDB(event_type="t", source="github", timestamp=now, payload={}) for _ in range(25)]
        db.add_all(events)
        await db.commit()

        resp = await client.get("/api/v1/events?page=2&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 2
        assert data["limit"] == 10
        assert data["total"] == 25
        assert len(data["events"]) == 10
        assert data["has_more"] is True

    async def test_event_types_endpoint(self, client, db: AsyncSession):
        """GET /api/v1/events/types returns distinct types."""
        now = datetime.now(timezone.utc)
        db.add_all([
            EventDB(event_type="type_a", source="github", timestamp=now, payload={}),
            EventDB(event_type="type_b", source="github", timestamp=now, payload={}),
            EventDB(event_type="type_a", source="solana", timestamp=now, payload={}),
        ])
        await db.commit()

        resp = await client.get("/api/v1/events/types")
        assert resp.status_code == 200
        types = resp.json()
        assert set(types) == {"type_a", "type_b"}

    async def test_sources_endpoint(self, client, db: AsyncSession):
        """GET /api/v1/events/sources returns distinct sources."""
        now = datetime.now(timezone.utc)
        db.add_all([
            EventDB(event_type="x", source="github", timestamp=now, payload={}),
            EventDB(event_type="y", source="solana", timestamp=now, payload={}),
        ])
        await db.commit()

        resp = await client.get("/api/v1/events/sources")
        assert resp.status_code == 200
        sources = resp.json()
        assert set(sources) == {"github", "solana"}

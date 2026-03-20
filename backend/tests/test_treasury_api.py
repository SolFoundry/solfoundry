"""Tests for treasury, payout, buyback, and tokenomics endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.treasury import (
    BuybackHistoryQuery,
    BuybackHistoryResponse,
    BuybackRecord,
    DataSourceStatus,
    PayoutHistoryQuery,
    PayoutHistoryResponse,
    PayoutRecord,
    TokenMetadata,
    TokenomicsAllocation,
    TokenomicsSummaryResponse,
    TreasuryDataSource,
    TreasuryStatsResponse,
)
from app.services.treasury_service import (
    SolanaTreasuryAdapter,
    TreasuryQueryService,
    get_treasury_service,
)

client = TestClient(app)


class StubTreasuryAdapter:
    """Deterministic adapter for API contract tests."""

    def __init__(self):
        self.calls = {
            "payout_history": 0,
            "buyback_history": 0,
            "treasury_stats": 0,
            "tokenomics_summary": 0,
        }
        self.payout_records = [
            PayoutRecord(
                signature="sig-new",
                recipient_wallet="wallet-a",
                gross_amount=100.0,
                fee_amount=5.0,
                net_amount=95.0,
                token_mint="mint-1",
                github_issue_number=15,
                github_pr_url="https://github.com/SolFoundry/solfoundry/pull/15",
                block_time=datetime(2025, 1, 10, tzinfo=timezone.utc),
                status="confirmed",
            ),
            PayoutRecord(
                signature="sig-old",
                recipient_wallet="wallet-b",
                gross_amount=50.0,
                fee_amount=2.5,
                net_amount=47.5,
                token_mint="mint-1",
                github_issue_number=14,
                block_time=datetime(2025, 1, 5, tzinfo=timezone.utc),
                status="pending",
            ),
        ]
        self.buyback_records = [
            BuybackRecord(
                signature="buy-1",
                amount_spent=7.5,
                token_amount_acquired=125.0,
                token_mint="mint-1",
                block_time=datetime(2025, 1, 9, tzinfo=timezone.utc),
            ),
        ]
        self.source = TreasuryDataSource(
            status=DataSourceStatus.configured,
            adapter="StubTreasuryAdapter",
            detail="test fixture",
        )

    async def fetch_payout_history(self, query: PayoutHistoryQuery) -> PayoutHistoryResponse:
        self.calls["payout_history"] += 1
        items = self.payout_records
        if query.recipient_wallet:
            items = [item for item in items if item.recipient_wallet == query.recipient_wallet]
        if query.status:
            items = [item for item in items if item.status == query.status]
        page = items[query.offset : query.offset + query.limit]
        return PayoutHistoryResponse(
            items=page,
            total=len(items),
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + query.limit < len(items),
            source=self.source,
        )

    async def fetch_buyback_history(self, query: BuybackHistoryQuery) -> BuybackHistoryResponse:
        self.calls["buyback_history"] += 1
        page = self.buyback_records[query.offset : query.offset + query.limit]
        return BuybackHistoryResponse(
            items=page,
            total=len(self.buyback_records),
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + query.limit < len(self.buyback_records),
            source=self.source,
        )

    async def fetch_treasury_stats(self) -> TreasuryStatsResponse:
        self.calls["treasury_stats"] += 1
        return TreasuryStatsResponse(
            treasury_wallet="wallet-treasury",
            token_mint="mint-1",
            current_balance=900.0,
            payout_count=2,
            buyback_count=1,
            total_distributed=150.0,
            total_fees_collected=7.5,
            total_buybacks=7.5,
            most_recent_payout_at=datetime(2025, 1, 10, tzinfo=timezone.utc),
            most_recent_buyback_at=datetime(2025, 1, 9, tzinfo=timezone.utc),
            source=self.source,
        )

    async def fetch_tokenomics_summary(self) -> TokenomicsSummaryResponse:
        self.calls["tokenomics_summary"] += 1
        return TokenomicsSummaryResponse(
            token=TokenMetadata(
                symbol="FNDRY",
                chain="solana",
                mint="mint-1",
                treasury_wallet="wallet-treasury",
            ),
            payout_token="FNDRY",
            buyback_rate=0.05,
            allocations=[
                TokenomicsAllocation(name="bounty_treasury", description="Core allocation"),
            ],
            utility=["Bounty rewards", "Platform fees"],
            treasury=await self.fetch_treasury_stats(),
            source=self.source,
        )


@pytest.fixture
def treasury_service_override():
    """Override the treasury dependency with a deterministic stub."""
    adapter = StubTreasuryAdapter()
    service = TreasuryQueryService(adapter=adapter)
    app.dependency_overrides[get_treasury_service] = lambda: service
    yield service, adapter
    app.dependency_overrides.clear()


def test_payout_history_endpoint_filters_and_paginates(treasury_service_override):
    _, _adapter = treasury_service_override
    resp = client.get("/api/payouts/history?recipient_wallet=wallet-a&status=confirmed&limit=1")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total"] == 1
    assert data["has_more"] is False
    assert len(data["items"]) == 1
    assert data["items"][0]["signature"] == "sig-new"
    assert data["items"][0]["gross_amount"] == 100.0


def test_buyback_history_endpoint_returns_records(treasury_service_override):
    _, adapter = treasury_service_override
    resp = client.get("/api/buybacks/history")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total"] == 1
    assert data["items"][0]["signature"] == "buy-1"
    assert adapter.calls["buyback_history"] == 1


def test_treasury_stats_endpoint_returns_aggregate_metrics(treasury_service_override):
    _, adapter = treasury_service_override
    resp = client.get("/api/treasury/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["current_balance"] == 900.0
    assert data["total_distributed"] == 150.0
    assert data["total_fees_collected"] == 7.5
    assert data["source"]["status"] == "configured"
    assert adapter.calls["treasury_stats"] == 1


def test_tokenomics_summary_endpoint_returns_treasury_context(treasury_service_override):
    _, _adapter = treasury_service_override
    resp = client.get("/api/tokenomics/summary")
    assert resp.status_code == 200
    data = resp.json()

    assert data["token"]["symbol"] == "FNDRY"
    assert data["buyback_rate"] == 0.05
    assert data["treasury"]["total_buybacks"] == 7.5
    assert data["allocations"][0]["name"] == "bounty_treasury"


@pytest.mark.asyncio
async def test_query_service_caches_identical_payout_requests():
    adapter = StubTreasuryAdapter()
    service = TreasuryQueryService(adapter=adapter)

    query = PayoutHistoryQuery(limit=10, offset=0)
    first = await service.get_payout_history(query)
    second = await service.get_payout_history(query)

    assert first.total == 2
    assert second.total == 2
    assert adapter.calls["payout_history"] == 1


@pytest.mark.asyncio
async def test_solana_adapter_uses_configured_records_and_balance_fallback():
    adapter = SolanaTreasuryAdapter(
        payout_records=[
            PayoutRecord(
                signature="sig-1",
                recipient_wallet="wallet-1",
                gross_amount=25.0,
                fee_amount=1.25,
                net_amount=23.75,
                token_mint="mint-1",
                block_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
            )
        ],
        buyback_records=[
            BuybackRecord(
                signature="buy-1",
                amount_spent=1.25,
                token_amount_acquired=20.0,
                token_mint="mint-1",
                block_time=datetime(2025, 1, 2, tzinfo=timezone.utc),
            )
        ],
        configured_balance=500.0,
        rpc_url="http://127.0.0.1:0",
    )

    stats = await adapter.fetch_treasury_stats()
    payouts = await adapter.fetch_payout_history(PayoutHistoryQuery())

    assert stats.current_balance == 500.0
    assert stats.total_distributed == 25.0
    assert stats.total_fees_collected == 1.25
    assert stats.source.status == DataSourceStatus.configured
    assert payouts.source.status == DataSourceStatus.configured


@pytest.mark.asyncio
async def test_solana_adapter_aggregates_live_rpc_balance():
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "result": {
                    "value": [
                        {
                            "account": {
                                "data": {
                                    "parsed": {
                                        "info": {
                                            "tokenAmount": {"uiAmount": 12.5},
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "account": {
                                "data": {
                                    "parsed": {
                                        "info": {
                                            "tokenAmount": {"uiAmountString": "7.25"},
                                        }
                                    }
                                }
                            }
                        },
                    ]
                }
            }

    class FakeAsyncClient:
        async def post(self, _url: str, json: dict) -> FakeResponse:
            assert json["method"] == "getTokenAccountsByOwner"
            return FakeResponse()

    adapter = SolanaTreasuryAdapter(
        payout_records=[],
        buyback_records=[],
        http_client=FakeAsyncClient(),
    )

    stats = await adapter.fetch_treasury_stats()
    assert stats.current_balance == 19.75
    assert stats.source.status == DataSourceStatus.live

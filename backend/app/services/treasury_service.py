"""Treasury query services and Solana adapter abstraction."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Protocol, TypeVar

import httpx

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
from app.services.cache import AsyncTTLCache

logger = logging.getLogger(__name__)

DEFAULT_FNDRY_MINT = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
DEFAULT_TREASURY_WALLET = "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
DEFAULT_BUYBACK_RATE = 0.05
CACHE_TTL_SECONDS = 60


class TreasuryDataAdapter(Protocol):
    """Read-only data adapter for treasury endpoints."""

    async def fetch_payout_history(self, query: PayoutHistoryQuery) -> PayoutHistoryResponse:
        """Fetch payout records for API reads."""

    async def fetch_buyback_history(self, query: BuybackHistoryQuery) -> BuybackHistoryResponse:
        """Fetch buyback records for API reads."""

    async def fetch_treasury_stats(self) -> TreasuryStatsResponse:
        """Fetch aggregate treasury metrics."""

    async def fetch_tokenomics_summary(self) -> TokenomicsSummaryResponse:
        """Fetch tokenomics metadata plus treasury stats."""


TModel = TypeVar("TModel", PayoutRecord, BuybackRecord)


def _parse_datetime(value: Any) -> Optional[datetime]:
    """Normalize timestamp values from JSON/env fixtures."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    raise ValueError(f"Unsupported datetime value: {value!r}")


def _load_json_records(file_env: str, inline_env: str) -> list[dict[str, Any]]:
    """Load fixture-style records from a file path or inline JSON env var."""
    if os.getenv(file_env):
        payload = Path(os.environ[file_env]).read_text()
    elif os.getenv(inline_env):
        payload = os.environ[inline_env]
    else:
        return []

    data = json.loads(payload)
    if not isinstance(data, list):
        raise ValueError(f"{file_env}/{inline_env} must contain a JSON array")
    return data


def _parse_records(items: list[dict[str, Any]], model_cls: type[TModel]) -> list[TModel]:
    """Parse configured record fixtures into typed models."""
    parsed: list[TModel] = []
    for item in items:
        payload = dict(item)
        if "block_time" in payload:
            payload["block_time"] = _parse_datetime(payload["block_time"])
        parsed.append(model_cls.model_validate(payload))
    parsed.sort(key=lambda record: (record.block_time or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
    return parsed


class SolanaTreasuryAdapter:
    """MVP adapter for treasury queries.

    This adapter supports:
    - configured payout and buyback history from JSON fixtures or env vars
    - optional live treasury balance reads via Solana JSON-RPC

    TODO:
    - Derive payout history from finalized token transfer transactions
    - Classify buyback flows from DEX swap instructions
    - Replace configured histories with indexed on-chain events or database sync
    """

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        treasury_wallet: Optional[str] = None,
        token_mint: Optional[str] = None,
        payout_records: Optional[list[PayoutRecord]] = None,
        buyback_records: Optional[list[BuybackRecord]] = None,
        configured_balance: Optional[float] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self.rpc_url = rpc_url or os.getenv("SOLANA_RPC_URL", DEFAULT_SOLANA_RPC_URL)
        self.treasury_wallet = treasury_wallet or os.getenv("SOLFOUNDRY_TREASURY_WALLET", DEFAULT_TREASURY_WALLET)
        self.token_mint = token_mint or os.getenv("FNDRY_TOKEN_MINT", DEFAULT_FNDRY_MINT)
        self.configured_balance = configured_balance
        if self.configured_balance is None and os.getenv("SOLFOUNDRY_TREASURY_BALANCE"):
            self.configured_balance = float(os.environ["SOLFOUNDRY_TREASURY_BALANCE"])
        self._http_client = http_client

        if payout_records is None:
            payout_records = _parse_records(
                _load_json_records("SOLFOUNDRY_PAYOUTS_FILE", "SOLFOUNDRY_PAYOUTS_JSON"),
                PayoutRecord,
            )
        if buyback_records is None:
            buyback_records = _parse_records(
                _load_json_records("SOLFOUNDRY_BUYBACKS_FILE", "SOLFOUNDRY_BUYBACKS_JSON"),
                BuybackRecord,
            )

        self._payout_records = payout_records
        self._buyback_records = buyback_records

    async def fetch_payout_history(self, query: PayoutHistoryQuery) -> PayoutHistoryResponse:
        records = self._payout_records
        if query.recipient_wallet:
            wallet = query.recipient_wallet.lower()
            records = [record for record in records if record.recipient_wallet.lower() == wallet]
        if query.status:
            status = query.status.lower()
            records = [record for record in records if record.status.lower() == status]

        page = records[query.offset : query.offset + query.limit]
        return PayoutHistoryResponse(
            items=page,
            total=len(records),
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + query.limit < len(records),
            source=self._history_source("payout history"),
        )

    async def fetch_buyback_history(self, query: BuybackHistoryQuery) -> BuybackHistoryResponse:
        records = self._buyback_records
        page = records[query.offset : query.offset + query.limit]
        return BuybackHistoryResponse(
            items=page,
            total=len(records),
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + query.limit < len(records),
            source=self._history_source("buyback history"),
        )

    async def fetch_treasury_stats(self) -> TreasuryStatsResponse:
        balance, source = await self._resolve_current_balance()
        return TreasuryStatsResponse(
            treasury_wallet=self.treasury_wallet,
            token_mint=self.token_mint,
            current_balance=balance,
            payout_count=len(self._payout_records),
            buyback_count=len(self._buyback_records),
            total_distributed=round(sum(record.gross_amount for record in self._payout_records), 9),
            total_fees_collected=round(sum(record.fee_amount for record in self._payout_records), 9),
            total_buybacks=round(sum(record.amount_spent for record in self._buyback_records), 9),
            most_recent_payout_at=next((record.block_time for record in self._payout_records if record.block_time), None),
            most_recent_buyback_at=next((record.block_time for record in self._buyback_records if record.block_time), None),
            source=source,
        )

    async def fetch_tokenomics_summary(self) -> TokenomicsSummaryResponse:
        treasury = await self.fetch_treasury_stats()
        return TokenomicsSummaryResponse(
            token=TokenMetadata(
                symbol="FNDRY",
                chain="solana",
                mint=self.token_mint,
                treasury_wallet=self.treasury_wallet,
            ),
            payout_token="FNDRY",
            buyback_rate=DEFAULT_BUYBACK_RATE,
            allocations=[
                TokenomicsAllocation(
                    name="bounty_treasury",
                    description="Core allocation for contributor payouts and treasury growth.",
                ),
                TokenomicsAllocation(
                    name="liquidity",
                    description="Bags bonding curve liquidity for permissionless market access.",
                ),
                TokenomicsAllocation(
                    name="dev_bootstrap",
                    description="1% dev allocation to bootstrap early bounty supply.",
                    percentage=1.0,
                ),
            ],
            utility=[
                "Bounty rewards",
                "Reputation weight",
                "Staking (coming)",
                "Governance (coming)",
                "Platform fees",
            ],
            treasury=treasury,
            source=treasury.source,
        )

    def _history_source(self, detail: str) -> TreasuryDataSource:
        if self._payout_records or self._buyback_records:
            return TreasuryDataSource(
                status=DataSourceStatus.configured,
                adapter=self.__class__.__name__,
                detail=f"{detail} is sourced from configured records until on-chain indexing is added",
            )
        return TreasuryDataSource(
            status=DataSourceStatus.unavailable,
            adapter=self.__class__.__name__,
            detail=f"No configured {detail}; live transaction parsing is a TODO",
        )

    async def _resolve_current_balance(self) -> tuple[Optional[float], TreasuryDataSource]:
        rpc_balance = await self._fetch_token_balance_from_rpc()
        if rpc_balance is not None:
            return (
                rpc_balance,
                TreasuryDataSource(
                    status=DataSourceStatus.live,
                    adapter=self.__class__.__name__,
                    detail="Current treasury balance fetched from Solana RPC",
                    last_success_at=datetime.now(timezone.utc),
                ),
            )

        if self.configured_balance is not None:
            return (
                self.configured_balance,
                TreasuryDataSource(
                    status=DataSourceStatus.configured,
                    adapter=self.__class__.__name__,
                    detail="Current treasury balance provided by configuration fallback",
                ),
            )

        return (
            None,
            TreasuryDataSource(
                status=DataSourceStatus.unavailable,
                adapter=self.__class__.__name__,
                detail="Treasury balance unavailable; check SOLANA_RPC_URL or SOLFOUNDRY_TREASURY_BALANCE",
            ),
        )

    async def _fetch_token_balance_from_rpc(self) -> Optional[float]:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                self.treasury_wallet,
                {"mint": self.token_mint},
                {"encoding": "jsonParsed"},
            ],
        }
        try:
            if self._http_client is not None:
                response = await self._http_client.post(self.rpc_url, json=payload)
            else:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.post(self.rpc_url, json=payload)
            response.raise_for_status()
            result = response.json().get("result", {})
            total = 0.0
            accounts = result.get("value", [])
            for account in accounts:
                parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                amount_info = parsed.get("info", {}).get("tokenAmount", {})
                amount = amount_info.get("uiAmount")
                if amount is None and amount_info.get("uiAmountString") is not None:
                    amount = float(amount_info["uiAmountString"])
                if amount is not None:
                    total += float(amount)
            return round(total, 9)
        except Exception as exc:  # pragma: no cover - exercised by fallback tests
            logger.warning("Failed to fetch treasury balance from Solana RPC: %s", exc)
            return None


class TreasuryQueryService:
    """Cached read service for treasury-related API endpoints."""

    def __init__(
        self,
        adapter: Optional[TreasuryDataAdapter] = None,
        cache: Optional[AsyncTTLCache[Any]] = None,
    ):
        self.adapter = adapter or SolanaTreasuryAdapter()
        self.cache = cache or AsyncTTLCache(ttl_seconds=CACHE_TTL_SECONDS)

    async def get_payout_history(self, query: PayoutHistoryQuery) -> PayoutHistoryResponse:
        key = f"payouts:{query.model_dump_json()}"
        return await self.cache.get_or_set(key, lambda: self.adapter.fetch_payout_history(query))

    async def get_buyback_history(self, query: BuybackHistoryQuery) -> BuybackHistoryResponse:
        key = f"buybacks:{query.model_dump_json()}"
        return await self.cache.get_or_set(key, lambda: self.adapter.fetch_buyback_history(query))

    async def get_treasury_stats(self) -> TreasuryStatsResponse:
        return await self.cache.get_or_set("treasury:stats", self.adapter.fetch_treasury_stats)

    async def get_tokenomics_summary(self) -> TokenomicsSummaryResponse:
        return await self.cache.get_or_set("treasury:tokenomics", self.adapter.fetch_tokenomics_summary)

    def invalidate_cache(self) -> None:
        """Clear the in-memory cache."""
        self.cache.invalidate()


_service: Optional[TreasuryQueryService] = None


def get_treasury_service() -> TreasuryQueryService:
    """FastAPI dependency provider for the treasury query service."""
    global _service
    if _service is None:
        _service = TreasuryQueryService()
    return _service

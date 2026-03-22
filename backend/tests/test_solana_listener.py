"""Test the Solana event listener (mocked WebSocket)."""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.solana_listener import SolanaEventListener, _processed_txs

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def clear_processed_txs():
    _processed_txs.clear()
    yield
    _processed_txs.clear()


async def test_listener_ingests_transfer_event(monkeypatch):
    """Given a logsNotification with FNDRY transfer, the listener ingests an event."""
    # Mock the ingest_solana_event function
    mock_ingest = AsyncMock()
    monkeypatch.setattr("app.services.solana_listener.ingest_solana_event", mock_ingest)

    listener = SolanaEventListener()
    # Simulate a message handler directly
    msg = {
        "jsonrpc": "2.0",
        "method": "logsNotification",
        "params": {
            "result": {
                "signature": "tx_sig_123",
                "slot": 12345,
                "blockTime": 1706053200,
                "logs": [
                    "Program F2G... invoke [1]",
                    "Program log: Instruction: Transfer",
                    "Program 2pN... consumption: 12000 CU",
                ],
            }
        },
    }

    # Send token transfer logs that include the FNDRY CA
    msg["params"]["result"]["logs"].insert(1, f"Program log: Mint: {os.getenv('FNDRY_TOKEN_CA')}")
    await listener._handle_log_notification(msg)

    assert mock_ingest.called
    call_kwargs = mock_ingest.call_args.kwargs
    assert call_kwargs["event_type"] == "token_transfer"
    assert call_kwargs["tx_hash"] == "tx_sig_123"
    assert call_kwargs["slot"] == 12345


async def test_listener_deduplicates(monkeypatch):
    """Same tx signature should not be ingested twice."""
    mock_ingest = AsyncMock()
    monkeypatch.setattr("app.services.solana_listener.ingest_solana_event", mock_ingest)

    listener = SolanaEventListener()
    msg = {
        "jsonrpc": "2.0",
        "method": "logsNotification",
        "params": {
            "result": {
                "signature": "duplicate_tx",
                "slot": 1,
                "logs": ["log1"],
            }
        },
    }

    await listener._handle_log_notification(msg)
    assert mock_ingest.call_count == 1

    await listener._handle_log_notification(msg)
    assert mock_ingest.call_count == 1  # no second call

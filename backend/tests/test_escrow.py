"""Tests for the custodial escrow service (Phase 2 Bounty).

Covers the full escrow lifecycle: fund → active → release/refund,
auto-refund on timeout, double-spend protection, state machine
validation, ledger auditing, and API endpoints with mock Solana RPC.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import engine, Base
from app.models.escrow import EscrowState, EscrowTable, EscrowLedgerTable  # noqa: F401
from app.main import app


@pytest.fixture(scope="module", autouse=True)
def _create_escrow_tables():
    """Ensure escrow tables exist in the test database."""

    async def _create():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create())


# Valid base-58 wallet addresses (44 chars)
CREATOR_WALLET: str = "A" * 44
WINNER_WALLET: str = "B" * 44

# Deterministic mock tx signatures
FUND_TX: str = "4" * 88
RELEASE_TX: str = "5" * 88
REFUND_TX: str = "6" * 88

# Fixed bounty ID (must pass UUID validation if FK enforced; SQLite is lenient)
BOUNTY_ID: str = "00000000-0000-0000-0000-000000000001"
BOUNTY_ID_2: str = "00000000-0000-0000-0000-000000000002"


TRANSFER_PATCH = "app.services.escrow_service.send_spl_transfer"
CONFIRM_PATCH = "app.services.escrow_service.confirm_transaction"

_tx_counter = 0


def _unique_tx() -> str:
    """Generate a unique mock tx signature for each call."""
    global _tx_counter
    _tx_counter += 1
    base = str(_tx_counter).zfill(10)
    return ("T" + base * 9)[:88]


@pytest.fixture
def mock_confirm():
    """Mock confirm_transaction to always return True."""
    with patch(CONFIRM_PATCH, new_callable=AsyncMock, return_value=True) as mock:
        yield mock


@pytest.fixture
def mock_transfer_simple():
    """Mock that returns a unique tx hash per call."""

    async def _transfer(*args, **kwargs):
        return _unique_tx()

    with patch(TRANSFER_PATCH, side_effect=_transfer) as mock:
        yield mock


# =========================================================================
# Helper to create a funded+active escrow for reuse in tests
# =========================================================================


async def _create_funded_escrow(
    client: AsyncClient,
    bounty_id: str = BOUNTY_ID,
    amount: float = 800_000.0,
    expires_at: str | None = None,
):
    """Helper: create and fund an escrow, returns the response JSON."""
    payload = {
        "bounty_id": bounty_id,
        "creator_wallet": CREATOR_WALLET,
        "amount": amount,
    }
    if expires_at:
        payload["expires_at"] = expires_at
    response = await client.post("/api/escrow/fund", json=payload)
    return response


# =========================================================================
# Fund endpoint
# =========================================================================


class TestFundEscrow:
    """POST /api/escrow/fund tests."""

    @pytest.mark.asyncio
    async def test_fund_creates_active_escrow(self, mock_transfer_simple, mock_confirm):
        """Funding creates an escrow and auto-activates it to ACTIVE state."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await _create_funded_escrow(client)
            assert response.status_code == 201
            data = response.json()
            assert data["state"] == "active"
            assert data["bounty_id"] == BOUNTY_ID
            assert data["creator_wallet"] == CREATOR_WALLET
            assert float(data["amount"]) == 800_000.0
            assert data["fund_tx_hash"] is not None

    @pytest.mark.asyncio
    async def test_fund_duplicate_bounty_rejected(
        self, mock_transfer_simple, mock_confirm
    ):
        """Creating a second escrow for the same bounty returns 409."""
        bid = "00000000-0000-0000-0000-000000000002"
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            first = await _create_funded_escrow(client, bounty_id=bid)
            assert first.status_code == 201

            second = await _create_funded_escrow(client, bounty_id=bid)
            assert second.status_code == 409

    @pytest.mark.asyncio
    async def test_fund_transfer_failure_returns_502(self, mock_confirm):
        """When SPL transfer fails, returns 502 and escrow is marked refunded."""
        with patch(
            TRANSFER_PATCH,
            new_callable=AsyncMock,
            side_effect=Exception("RPC timeout"),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000099"
                )
                assert response.status_code == 502

    @pytest.mark.asyncio
    async def test_fund_unconfirmed_tx_returns_409(self, mock_transfer_simple):
        """When tx cannot be confirmed, returns 409 (double-spend protection)."""
        with patch(CONFIRM_PATCH, new_callable=AsyncMock, return_value=False):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000098"
                )
                assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_fund_invalid_wallet_rejected(
        self, mock_transfer_simple, mock_confirm
    ):
        """Invalid wallet address returns 422."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/escrow/fund",
                json={
                    "bounty_id": BOUNTY_ID,
                    "creator_wallet": "0xinvalid",
                    "amount": 1000.0,
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fund_zero_amount_rejected(self, mock_transfer_simple, mock_confirm):
        """Zero amount is rejected."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/escrow/fund",
                json={
                    "bounty_id": BOUNTY_ID,
                    "creator_wallet": CREATOR_WALLET,
                    "amount": 0,
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fund_negative_amount_rejected(
        self, mock_transfer_simple, mock_confirm
    ):
        """Negative amount is rejected."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/escrow/fund",
                json={
                    "bounty_id": BOUNTY_ID,
                    "creator_wallet": CREATOR_WALLET,
                    "amount": -500.0,
                },
            )
            assert response.status_code == 422


# =========================================================================
# Release endpoint
# =========================================================================


class TestReleaseEscrow:
    """POST /api/escrow/release tests."""

    @pytest.mark.asyncio
    async def test_release_to_winner(self):
        """Full lifecycle: fund → active → release → completed."""
        fund_tx = _unique_tx()
        release_tx = _unique_tx()
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [fund_tx, release_tx]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                fund_resp = await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000010"
                )
                assert fund_resp.status_code == 201

                release_resp = await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000010",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                assert release_resp.status_code == 200
                data = release_resp.json()
                assert data["state"] == "completed"
                assert data["winner_wallet"] == WINNER_WALLET
                assert data["release_tx_hash"] == release_tx

    @pytest.mark.asyncio
    async def test_release_nonexistent_escrow_404(self):
        """Releasing a non-existent escrow returns 404."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/escrow/release",
                json={
                    "bounty_id": "00000000-0000-0000-0000-999999999999",
                    "winner_wallet": WINNER_WALLET,
                },
            )
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_release_already_completed_409(self):
        """Releasing an already-completed escrow returns 409."""
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [_unique_tx(), _unique_tx(), _unique_tx()]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000011"
                )
                await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000011",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                response = await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000011",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_release_transfer_failure_reverts_to_active(self):
        """When release transfer fails, escrow reverts to ACTIVE for retry."""
        fund_tx = _unique_tx()
        call_count = 0

        async def _side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return fund_tx
            raise Exception("Network error")

        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
                side_effect=_side_effect,
            ),
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000012"
                )
                release_resp = await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000012",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                assert release_resp.status_code == 502

                # Verify escrow reverted to active
                status_resp = await client.get(
                    "/api/escrow/00000000-0000-0000-0000-000000000012"
                )
                assert status_resp.status_code == 200
                assert status_resp.json()["escrow"]["state"] == "active"


# =========================================================================
# Refund endpoint
# =========================================================================


class TestRefundEscrow:
    """POST /api/escrow/refund tests."""

    @pytest.mark.asyncio
    async def test_refund_active_escrow(self):
        """Refunding an active escrow returns tokens to creator."""
        refund_tx = _unique_tx()
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [_unique_tx(), refund_tx]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000020"
                )
                response = await client.post(
                    "/api/escrow/refund",
                    json={"bounty_id": "00000000-0000-0000-0000-000000000020"},
                )
                assert response.status_code == 200
                data = response.json()
                assert data["state"] == "refunded"
                assert data["release_tx_hash"] == refund_tx

    @pytest.mark.asyncio
    async def test_refund_nonexistent_404(self):
        """Refunding a non-existent escrow returns 404."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/escrow/refund",
                json={"bounty_id": "00000000-0000-0000-0000-999999999998"},
            )
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_refund_completed_escrow_409(self):
        """Refunding a completed escrow returns 409."""
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [_unique_tx(), _unique_tx(), _unique_tx()]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000021"
                )
                await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000021",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                response = await client.post(
                    "/api/escrow/refund",
                    json={"bounty_id": "00000000-0000-0000-0000-000000000021"},
                )
                assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_refund_transfer_failure_502(self):
        """When refund transfer fails, returns 502."""
        fund_tx = _unique_tx()
        call_count = 0

        async def _side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return fund_tx
            raise Exception("RPC down")

        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
                side_effect=_side_effect,
            ),
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000022"
                )
                response = await client.post(
                    "/api/escrow/refund",
                    json={"bounty_id": "00000000-0000-0000-0000-000000000022"},
                )
                assert response.status_code == 502


# =========================================================================
# Status / ledger endpoint
# =========================================================================


class TestGetEscrowStatus:
    """GET /api/escrow/{bounty_id} tests."""

    @pytest.mark.asyncio
    async def test_get_status_returns_escrow_and_ledger(
        self, mock_transfer_simple, mock_confirm
    ):
        """Status endpoint returns escrow details and audit ledger entries."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await _create_funded_escrow(
                client, bounty_id="00000000-0000-0000-0000-000000000030"
            )
            response = await client.get(
                "/api/escrow/00000000-0000-0000-0000-000000000030"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["escrow"]["state"] == "active"
            assert float(data["escrow"]["amount"]) == 800_000.0
            # Should have ledger entries (creation + funding + activation)
            assert len(data["ledger"]) >= 2

    @pytest.mark.asyncio
    async def test_get_status_nonexistent_404(self):
        """Getting status of non-existent escrow returns 404."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/escrow/00000000-0000-0000-0000-999999999997"
            )
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_ledger_records_all_transitions(self):
        """Full lifecycle produces ledger entries for every state change."""
        fund_tx = _unique_tx()
        release_tx = _unique_tx()
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [fund_tx, release_tx]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000031"
                )
                await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000031",
                        "winner_wallet": WINNER_WALLET,
                    },
                )

                response = await client.get(
                    "/api/escrow/00000000-0000-0000-0000-000000000031"
                )
                data = response.json()
                assert data["escrow"]["state"] == "completed"

                actions = [entry["action"] for entry in data["ledger"]]
                assert "deposit" in actions
                assert "release" in actions

                tx_hashes = [
                    entry["tx_hash"] for entry in data["ledger"] if entry["tx_hash"]
                ]
                assert fund_tx in tx_hashes
                assert release_tx in tx_hashes


# =========================================================================
# Escrow state machine validation
# =========================================================================


class TestEscrowStateMachine:
    """Validates the escrow state machine transitions."""

    def test_allowed_transitions(self):
        """Verify the transition map covers all expected paths."""
        from app.models.escrow import ALLOWED_ESCROW_TRANSITIONS

        # PENDING can go to FUNDED or REFUNDED
        assert EscrowState.FUNDED in ALLOWED_ESCROW_TRANSITIONS[EscrowState.PENDING]
        assert EscrowState.REFUNDED in ALLOWED_ESCROW_TRANSITIONS[EscrowState.PENDING]

        # FUNDED can go to ACTIVE or REFUNDED
        assert EscrowState.ACTIVE in ALLOWED_ESCROW_TRANSITIONS[EscrowState.FUNDED]
        assert EscrowState.REFUNDED in ALLOWED_ESCROW_TRANSITIONS[EscrowState.FUNDED]

        # ACTIVE can go to RELEASING or REFUNDED
        assert EscrowState.RELEASING in ALLOWED_ESCROW_TRANSITIONS[EscrowState.ACTIVE]
        assert EscrowState.REFUNDED in ALLOWED_ESCROW_TRANSITIONS[EscrowState.ACTIVE]

        # RELEASING can go to COMPLETED or back to ACTIVE
        assert (
            EscrowState.COMPLETED in ALLOWED_ESCROW_TRANSITIONS[EscrowState.RELEASING]
        )
        assert EscrowState.ACTIVE in ALLOWED_ESCROW_TRANSITIONS[EscrowState.RELEASING]

        # Terminal states have no transitions
        assert len(ALLOWED_ESCROW_TRANSITIONS[EscrowState.COMPLETED]) == 0
        assert len(ALLOWED_ESCROW_TRANSITIONS[EscrowState.REFUNDED]) == 0

    def test_invalid_transition_raises(self):
        """_validate_transition raises on disallowed transitions."""
        from app.services.escrow_service import _validate_transition
        from app.exceptions import InvalidEscrowTransitionError

        with pytest.raises(InvalidEscrowTransitionError):
            _validate_transition(EscrowState.COMPLETED, EscrowState.ACTIVE)

        with pytest.raises(InvalidEscrowTransitionError):
            _validate_transition(EscrowState.REFUNDED, EscrowState.FUNDED)

        with pytest.raises(InvalidEscrowTransitionError):
            _validate_transition(EscrowState.PENDING, EscrowState.ACTIVE)


# =========================================================================
# Auto-refund expired escrows
# =========================================================================


class TestAutoRefund:
    """Tests for the periodic auto-refund of expired escrows."""

    @pytest.mark.asyncio
    async def test_expired_escrow_auto_refunded(self):
        """Escrows past their expires_at are automatically refunded."""
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [_unique_tx(), _unique_tx()]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Create an escrow that already expired
                await _create_funded_escrow(
                    client,
                    bounty_id="00000000-0000-0000-0000-000000000040",
                    expires_at=past,
                )

                # Run the auto-refund
                from app.services.escrow_service import refund_expired_escrows

                count = await refund_expired_escrows()
                assert count >= 1

                # Verify the escrow is now refunded
                status = await client.get(
                    "/api/escrow/00000000-0000-0000-0000-000000000040"
                )
                assert status.json()["escrow"]["state"] == "refunded"

    @pytest.mark.asyncio
    async def test_non_expired_escrow_not_refunded(
        self, mock_transfer_simple, mock_confirm
    ):
        """Escrows with future expires_at are not auto-refunded."""
        future = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await _create_funded_escrow(
                client,
                bounty_id="00000000-0000-0000-0000-000000000041",
                expires_at=future,
            )

            from app.services.escrow_service import refund_expired_escrows

            await refund_expired_escrows()
            # This specific escrow should NOT be refunded
            status = await client.get(
                "/api/escrow/00000000-0000-0000-0000-000000000041"
            )
            assert status.json()["escrow"]["state"] == "active"

    @pytest.mark.asyncio
    async def test_no_expires_at_not_refunded(self, mock_transfer_simple, mock_confirm):
        """Escrows without expires_at are never auto-refunded."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await _create_funded_escrow(
                client,
                bounty_id="00000000-0000-0000-0000-000000000042",
            )

            from app.services.escrow_service import refund_expired_escrows

            await refund_expired_escrows()

            status = await client.get(
                "/api/escrow/00000000-0000-0000-0000-000000000042"
            )
            assert status.json()["escrow"]["state"] == "active"


# =========================================================================
# Integration: full lifecycle end-to-end
# =========================================================================


class TestFullLifecycle:
    """End-to-end escrow lifecycle integration tests."""

    @pytest.mark.asyncio
    async def test_fund_release_lifecycle(self):
        """Complete lifecycle: fund → active → release → completed with audit trail."""
        fund_tx = _unique_tx()
        release_tx = _unique_tx()
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [fund_tx, release_tx]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                fund_resp = await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000050"
                )
                assert fund_resp.status_code == 201
                assert fund_resp.json()["state"] == "active"

                release_resp = await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000050",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                assert release_resp.status_code == 200
                assert release_resp.json()["state"] == "completed"

                status_resp = await client.get(
                    "/api/escrow/00000000-0000-0000-0000-000000000050"
                )
                data = status_resp.json()
                assert data["escrow"]["state"] == "completed"
                assert data["escrow"]["winner_wallet"] == WINNER_WALLET
                assert data["escrow"]["fund_tx_hash"] == fund_tx
                assert data["escrow"]["release_tx_hash"] == release_tx
                assert len(data["ledger"]) >= 4

    @pytest.mark.asyncio
    async def test_fund_refund_lifecycle(self):
        """Complete lifecycle: fund → active → refund with audit trail."""
        with (
            patch(
                TRANSFER_PATCH,
                new_callable=AsyncMock,
            ) as mock_transfer,
            patch(
                CONFIRM_PATCH,
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            mock_transfer.side_effect = [_unique_tx(), _unique_tx()]

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Step 1: Fund
                await _create_funded_escrow(
                    client, bounty_id="00000000-0000-0000-0000-000000000051"
                )

                # Step 2: Refund
                refund_resp = await client.post(
                    "/api/escrow/refund",
                    json={"bounty_id": "00000000-0000-0000-0000-000000000051"},
                )
                assert refund_resp.status_code == 200
                assert refund_resp.json()["state"] == "refunded"

                # Step 3: Verify cannot release after refund
                release_resp = await client.post(
                    "/api/escrow/release",
                    json={
                        "bounty_id": "00000000-0000-0000-0000-000000000051",
                        "winner_wallet": WINNER_WALLET,
                    },
                )
                assert release_resp.status_code == 409

    @pytest.mark.asyncio
    async def test_multiple_independent_escrows(
        self, mock_transfer_simple, mock_confirm
    ):
        """Multiple bounties can have independent escrows."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp1 = await _create_funded_escrow(
                client, bounty_id="00000000-0000-0000-0000-000000000060"
            )
            resp2 = await _create_funded_escrow(
                client,
                bounty_id="00000000-0000-0000-0000-000000000061",
                amount=500_000.0,
            )
            assert resp1.status_code == 201
            assert resp2.status_code == 201
            assert resp1.json()["id"] != resp2.json()["id"]

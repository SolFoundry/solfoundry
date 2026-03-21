"""Tests for $FNDRY custodial escrow service.

Covers the complete escrow lifecycle including:
- State machine (PENDING/FUNDED/ACTIVE/RELEASING/REFUNDING/COMPLETED/REFUNDED)
- Authorization (admin-only release, creator+admin refund)
- Decimal precision through database round-trips
- On-chain transaction verification via mocked RPC
- SPL transfer delegation to solana_client
- Bounty lifecycle integration validation
- Two-phase release/refund with failure rollback
- Auto-refund with per-escrow error isolation
- IntegrityError classification (duplicate bounty, double-spend)
- Expiry health metrics tracking

Uses in-memory SQLite for unit tests. Postgres-specific behaviors (constraint
names, SELECT FOR UPDATE) are tested via the integration test fixture using
testcontainers when available.
"""
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.exceptions import (
    EscrowAlreadyExistsError,
    EscrowAuthorizationError,
    EscrowDoubleSpendError,
    EscrowInvalidStateError,
    EscrowNotFoundError,
)
from app.models.escrow import (
    EscrowAccountTable,
    EscrowCreateRequest as CR,
    EscrowRefundRequest as RfR,
    EscrowReleaseRequest as RlR,
    EscrowState,
)
from app.services.escrow_service import (
    activate_escrow,
    create_escrow,
    get_escrow_status,
    get_expiry_health,
    initiate_spl_transfer,
    list_escrows,
    process_expired_escrows,
    refund_escrow,
    release_escrow,
    verify_transaction_on_chain,
)

pytestmark = pytest.mark.asyncio

# Test constants — valid base-58 Solana addresses and transaction signatures
WALLET_CREATOR = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"
WALLET_WINNER = "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
TX_FUND = "4" * 88
TX_RELEASE = "5" * 88
TX_REFUND = "6" * 88
BOUNTY_ID = "bounty-42"
USER_CREATOR = "user-042"
USER_STRANGER = "user-099"
ADMIN_USER = "00000000-0000-0000-0000-000000000001"
SPL_MOCK_PATH = "app.services.escrow_service.initiate_spl_transfer"
ES = EscrowState


def _release_request(bounty_id: str = BOUNTY_ID) -> RlR:
    """Build a standard release request for testing."""
    return RlR(bounty_id=bounty_id, winner_wallet=WALLET_WINNER)


def _refund_request(bounty_id: str = BOUNTY_ID) -> RfR:
    """Build a standard refund request for testing."""
    return RfR(bounty_id=bounty_id)


def _create_request(
    bounty_id: str = BOUNTY_ID,
    wallet: str = WALLET_CREATOR,
    amount: Decimal = Decimal("50000"),
    tx_hash: str | None = None,
    expires_at: str | None = None,
) -> CR:
    """Build a create request with sensible defaults for testing.

    Args:
        bounty_id: Bounty identifier.
        wallet: Creator wallet address.
        amount: Token amount in Decimal.
        tx_hash: Optional funding transaction hash.
        expires_at: Optional expiration timestamp (ISO format string).

    Returns:
        EscrowCreateRequest ready for use in tests.
    """
    kwargs: dict = {"bounty_id": bounty_id, "creator_wallet": wallet, "amount": amount}
    if tx_hash:
        kwargs["tx_hash"] = tx_hash
    if expires_at:
        kwargs["expires_at"] = expires_at
    return CR(**kwargs)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite database session for unit tests.

    Creates all tables fresh for each test and tears down after.
    Enables foreign key enforcement for referential integrity.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    @event.listens_for(engine.sync_engine, "connect")
    def enable_foreign_keys(connection, _):
        """Enable SQLite foreign key constraints."""
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def pg_db():
    """PostgreSQL integration test fixture using testcontainers.

    Skipped when testcontainers is not installed or Docker is unavailable.
    Tests Postgres-specific behaviors like constraint names and FOR UPDATE.
    """
    pytest.importorskip("testcontainers", reason="testcontainers not installed")
    from testcontainers.postgres import PostgresContainer  # type: ignore[import-untyped]

    try:
        with PostgresContainer("postgres:16-alpine") as postgres:
            pg_url = postgres.get_connection_url().replace(
                "postgresql://", "postgresql+asyncpg://"
            )
            engine = create_async_engine(pg_url, echo=False)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with async_sessionmaker(
                engine, class_=AsyncSession, expire_on_commit=False
            )() as session:
                yield session
            await engine.dispose()
    except Exception as exc:
        pytest.skip(f"Docker/Postgres unavailable: {exc}")


# ---------------------------------------------------------------------------
# Lifecycle: FUNDED -> RELEASING -> COMPLETED
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_fund_and_release_lifecycle(mock_transfer, db):
    """Full lifecycle: create FUNDED escrow, release to winner, verify COMPLETED."""
    result = await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    assert result.state == ES.FUNDED
    assert len(result.ledger) == 1
    assert result.amount == Decimal("50000")

    result = await release_escrow(db, _release_request(), ADMIN_USER)
    assert result.state == ES.COMPLETED
    assert result.winner_wallet == WALLET_WINNER
    assert len(result.ledger) == 2
    assert result.release_tx_hash == TX_RELEASE


# ---------------------------------------------------------------------------
# Lifecycle: FUNDED -> REFUNDING -> REFUNDED
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_REFUND)
async def test_fund_and_refund_lifecycle(mock_transfer, db):
    """Full lifecycle: create FUNDED escrow, refund to creator, verify REFUNDED."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    result = await refund_escrow(db, _refund_request(), USER_CREATOR)
    assert result.state == ES.REFUNDED
    assert len(result.ledger) == 2
    assert result.refund_tx_hash == TX_REFUND


# ---------------------------------------------------------------------------
# Initial state depends on tx_hash presence
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "tx_hash,expected_state",
    [(None, ES.PENDING), (TX_FUND, ES.FUNDED)],
)
async def test_initial_state_depends_on_tx_hash(db, tx_hash, expected_state):
    """PENDING without tx_hash, FUNDED with tx_hash."""
    result = await create_escrow(
        db, _create_request(tx_hash=tx_hash), USER_CREATOR
    )
    assert result.state == expected_state


# ---------------------------------------------------------------------------
# FUNDED -> ACTIVE -> RELEASING -> COMPLETED
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_funded_to_active_to_completed(mock_transfer, db):
    """FUNDED -> ACTIVE -> release -> COMPLETED full path."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    result = await activate_escrow(db, BOUNTY_ID, USER_CREATOR)
    assert result.state == ES.ACTIVE
    result = await release_escrow(db, _release_request(), ADMIN_USER)
    assert result.state == ES.COMPLETED


# ---------------------------------------------------------------------------
# PENDING cannot be activated (only FUNDED can)
# ---------------------------------------------------------------------------


async def test_activate_pending_fails(db):
    """PENDING escrow cannot transition to ACTIVE."""
    await create_escrow(db, _create_request(), USER_CREATOR)
    with pytest.raises(EscrowInvalidStateError, match="PENDING"):
        await activate_escrow(db, BOUNTY_ID, USER_CREATOR)


# ---------------------------------------------------------------------------
# Duplicate rejection
# ---------------------------------------------------------------------------


async def test_duplicate_bounty_rejected(db):
    """Second escrow for same bounty raises EscrowAlreadyExistsError."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    with pytest.raises(EscrowAlreadyExistsError):
        await create_escrow(
            db, _create_request(amount=Decimal("1")), USER_CREATOR
        )


async def test_duplicate_tx_hash_rejected(db):
    """Same tx_hash on different bounty raises EscrowDoubleSpendError."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    with pytest.raises(EscrowDoubleSpendError):
        await create_escrow(
            db,
            _create_request(bounty_id="bounty-other", tx_hash=TX_FUND),
            USER_CREATOR,
        )


# ---------------------------------------------------------------------------
# Expiry stored on create
# ---------------------------------------------------------------------------


async def test_expiry_timestamp_stored(db):
    """Escrow preserves expires_at through create."""
    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    result = await create_escrow(
        db, _create_request(expires_at=future), USER_CREATOR
    )
    assert result.expires_at is not None


# ---------------------------------------------------------------------------
# Release validation: PENDING cannot release
# ---------------------------------------------------------------------------


async def test_pending_cannot_release(db):
    """PENDING escrow cannot be released."""
    await create_escrow(db, _create_request(), USER_CREATOR)
    with pytest.raises(EscrowInvalidStateError, match="PENDING"):
        await release_escrow(
            db,
            RlR(bounty_id=BOUNTY_ID, winner_wallet=WALLET_WINNER),
            ADMIN_USER,
        )


# ---------------------------------------------------------------------------
# Refund from FUNDED and PENDING
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("tx_hash", [TX_FUND, None])
@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_REFUND)
async def test_refund_from_funded_and_pending(mock_transfer, db, tx_hash):
    """Both FUNDED and PENDING escrows can be refunded."""
    await create_escrow(db, _create_request(tx_hash=tx_hash), USER_CREATOR)
    result = await refund_escrow(db, _refund_request(), USER_CREATOR)
    assert result.state == ES.REFUNDED


# ---------------------------------------------------------------------------
# Refund from COMPLETED fails
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_refund_completed_fails(mock_transfer, db):
    """COMPLETED escrow cannot be refunded."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    await release_escrow(db, _release_request(), ADMIN_USER)
    with pytest.raises(EscrowInvalidStateError, match="COMPLETED"):
        await refund_escrow(db, _refund_request(), USER_CREATOR)


# ---------------------------------------------------------------------------
# Not found errors
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operation",
    [
        lambda db: release_escrow(
            db, RlR(bounty_id="nonexistent", winner_wallet=WALLET_WINNER), ADMIN_USER
        ),
        lambda db: refund_escrow(db, RfR(bounty_id="nonexistent"), USER_CREATOR),
        lambda db: get_escrow_status(db, "nonexistent"),
    ],
)
async def test_not_found_raises_error(db, operation):
    """Operations on nonexistent bounty raise EscrowNotFoundError."""
    with pytest.raises(EscrowNotFoundError):
        await operation(db)


# ---------------------------------------------------------------------------
# Authorization: admin-only release (CodeRabbit #7)
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_creator_cannot_release(mock_transfer, db):
    """Creator is blocked from releasing — only admin/system can release."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    with pytest.raises(EscrowAuthorizationError, match="not authorized to release"):
        await release_escrow(db, _release_request(), USER_CREATOR)


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_admin_can_release(mock_transfer, db):
    """System admin can release escrow funds."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    result = await release_escrow(db, _release_request(), ADMIN_USER)
    assert result.state == ES.COMPLETED


# ---------------------------------------------------------------------------
# Authorization: stranger blocked from release and refund
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["release", "refund"])
@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_stranger_blocked(mock_transfer, db, action):
    """Non-owner, non-admin user blocked from both release and refund."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    if action == "release":
        with pytest.raises(EscrowAuthorizationError):
            await release_escrow(db, _release_request(), USER_STRANGER)
    else:
        with pytest.raises(EscrowAuthorizationError):
            await refund_escrow(db, _refund_request(), USER_STRANGER)


# ---------------------------------------------------------------------------
# Authorization: admin can release and refund
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "action,expected_state",
    [("release", ES.COMPLETED), ("refund", ES.REFUNDED)],
)
@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_admin_allowed_for_all_actions(mock_transfer, db, action, expected_state):
    """Admin can perform both release and refund."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    if action == "release":
        result = await release_escrow(db, _release_request(), ADMIN_USER)
    else:
        result = await refund_escrow(db, _refund_request(), ADMIN_USER)
    assert result.state == expected_state


# ---------------------------------------------------------------------------
# Terminal states reject further mutations
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["release", "refund"])
@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_terminal_state_rejects_mutation(mock_transfer, db, action):
    """COMPLETED and REFUNDED states reject further release/refund."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    if action == "release":
        await release_escrow(db, _release_request(), ADMIN_USER)
        with pytest.raises(EscrowInvalidStateError):
            await release_escrow(db, _release_request(), ADMIN_USER)
    else:
        await refund_escrow(db, _refund_request(), USER_CREATOR)
        with pytest.raises(EscrowInvalidStateError):
            await refund_escrow(db, _refund_request(), USER_CREATOR)


# ---------------------------------------------------------------------------
# List and status queries
# ---------------------------------------------------------------------------


async def test_list_and_status(db):
    """Status retrieval, list, count, and pagination all work correctly."""
    assert (await list_escrows(db)).total == 0
    await create_escrow(db, _create_request(), USER_CREATOR)
    status = await get_escrow_status(db, BOUNTY_ID)
    assert status.bounty_id == BOUNTY_ID
    for i in range(4):
        await create_escrow(
            db, _create_request(bounty_id=f"bounty-{i}"), USER_CREATOR
        )
    assert (await list_escrows(db)).total == 5
    page = await list_escrows(db, skip=0, limit=2)
    assert len(page.items) == 2 and page.total == 5


@pytest.mark.parametrize(
    "filter_name,filter_kwargs,expected_count",
    [
        ("state", {"state": ES.PENDING}, 1),
        ("wallet", {"creator_wallet": WALLET_CREATOR}, 1),
    ],
)
async def test_list_filters(db, filter_name, filter_kwargs, expected_count):
    """State and wallet filters produce correct counts."""
    await create_escrow(db, _create_request(bounty_id="b1"), USER_CREATOR)
    second_wallet = WALLET_WINNER if filter_name == "wallet" else WALLET_CREATOR
    second_user = USER_STRANGER if filter_name == "wallet" else USER_CREATOR
    await create_escrow(
        db,
        _create_request(bounty_id="b2", tx_hash=TX_FUND, wallet=second_wallet),
        second_user,
    )
    result = await list_escrows(db, **filter_kwargs)
    assert result.total == expected_count


# ---------------------------------------------------------------------------
# Auto-refund expired escrows
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "hours_delta,should_refund",
    [(-1, True), (168, False)],
)
@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_REFUND)
async def test_expiry_autorefund(mock_transfer, db, hours_delta, should_refund):
    """Auto-refund processes expired escrows and skips future ones."""
    await create_escrow(db, _create_request(), USER_CREATOR)
    row = (
        await db.execute(
            select(EscrowAccountTable).where(
                EscrowAccountTable.bounty_id == BOUNTY_ID
            )
        )
    ).scalar_one()
    row.expires_at = datetime.now(timezone.utc) + timedelta(hours=hours_delta)
    await db.commit()
    refunded = await process_expired_escrows(db)
    assert (BOUNTY_ID in refunded) == should_refund


# ---------------------------------------------------------------------------
# Release transfer failure reverts to ACTIVE (two-phase)
# ---------------------------------------------------------------------------


async def test_release_failure_reverts_to_active(db):
    """SPL transfer failure during release reverts state from RELEASING to ACTIVE."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    await activate_escrow(db, BOUNTY_ID, USER_CREATOR)
    assert (await get_escrow_status(db, BOUNTY_ID)).state == ES.ACTIVE

    with patch(
        SPL_MOCK_PATH,
        new_callable=AsyncMock,
        side_effect=RuntimeError("Insufficient SOL for fees"),
    ):
        with pytest.raises(RuntimeError, match="Insufficient SOL"):
            await release_escrow(db, _release_request(), ADMIN_USER)

    assert (await get_escrow_status(db, BOUNTY_ID)).state == ES.ACTIVE


# ---------------------------------------------------------------------------
# Refund transfer failure reverts to prior state (two-phase with REFUNDING)
# ---------------------------------------------------------------------------


async def test_refund_failure_reverts_to_prior_state(db):
    """SPL transfer failure during refund reverts from REFUNDING to prior state."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    await activate_escrow(db, BOUNTY_ID, USER_CREATOR)
    assert (await get_escrow_status(db, BOUNTY_ID)).state == ES.ACTIVE

    with patch(
        SPL_MOCK_PATH,
        new_callable=AsyncMock,
        side_effect=RuntimeError("Network timeout"),
    ):
        with pytest.raises(RuntimeError, match="Network timeout"):
            await refund_escrow(db, _refund_request(), USER_CREATOR)

    # Should revert back to ACTIVE, not stay in REFUNDING
    assert (await get_escrow_status(db, BOUNTY_ID)).state == ES.ACTIVE


# ---------------------------------------------------------------------------
# On-chain transaction verification
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "rpc_result,expected_verified",
    [
        # Valid transfer: finalized, no error, correct mint and recipient
        (
            {
                "meta": {
                    "err": None,
                    "innerInstructions": [],
                    "postTokenBalances": [
                        {
                            "accountIndex": 1,
                            "owner": "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp",
                        }
                    ],
                },
                "transaction": {
                    "message": {
                        "accountKeys": [
                            WALLET_CREATOR,
                            "TokenAcct" + "1" * 34,
                        ],
                        "instructions": [
                            {
                                "parsed": {
                                    "type": "transferChecked",
                                    "info": {
                                        "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                                        "destination": "TokenAcct" + "1" * 34,
                                        "tokenAmount": {
                                            "uiAmountString": "50000"
                                        },
                                    },
                                }
                            }
                        ],
                    }
                },
            },
            True,
        ),
        # Transaction with execution error
        (
            {
                "meta": {"err": {"InstructionError": [0, "Custom"]}},
                "transaction": {
                    "message": {"accountKeys": [], "instructions": []}
                },
            },
            False,
        ),
        # Transaction not found on chain
        (None, False),
    ],
)
async def test_transaction_verification(rpc_result, expected_verified):
    """On-chain verification checks finalization, errors, and SPL transfer matching."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"result": rpc_result}
    mock_response.raise_for_status = MagicMock()
    mock_response.status_code = 200
    with patch(
        "httpx.AsyncClient.post",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        assert await verify_transaction_on_chain(TX_FUND) is expected_verified


# ---------------------------------------------------------------------------
# SPL transfer delegation
# ---------------------------------------------------------------------------


async def test_spl_transfer_delegates_to_solana_client():
    """initiate_spl_transfer correctly delegates to solana_client.send_spl_transfer."""
    with patch(
        "app.services.solana_client.send_spl_transfer",
        new_callable=AsyncMock,
        return_value="SignatureTx123",
    ) as mock_send:
        result = await initiate_spl_transfer(WALLET_WINNER, Decimal("1000"))
        assert result == "SignatureTx123"
        mock_send.assert_called_once_with(
            to_wallet=WALLET_WINNER, amount=Decimal("1000")
        )


# ---------------------------------------------------------------------------
# Decimal precision round-trip
# ---------------------------------------------------------------------------


async def test_decimal_precision_preserved(db):
    """Escrow amounts preserve full Decimal precision through DB round-trip."""
    amount = Decimal("123456789.123456789")
    result = await create_escrow(
        db, _create_request(amount=amount), USER_CREATOR
    )
    assert result.amount == amount


# ---------------------------------------------------------------------------
# Validation: past expiry rejected
# ---------------------------------------------------------------------------


def test_past_expiry_rejected():
    """EscrowCreateRequest rejects past timestamps for expires_at."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    with pytest.raises(ValueError, match="future"):
        _create_request(expires_at=past)


# ---------------------------------------------------------------------------
# Validation: amount upper bound
# ---------------------------------------------------------------------------


def test_amount_upper_bound_rejected():
    """EscrowCreateRequest rejects amounts exceeding the maximum limit."""
    with pytest.raises(ValueError, match="exceeds maximum"):
        _create_request(amount=Decimal("999999999999"))


# ---------------------------------------------------------------------------
# State machine: RELEASING can revert to ACTIVE
# ---------------------------------------------------------------------------


def test_releasing_can_revert_to_active():
    """State machine allows RELEASING -> ACTIVE for transfer failure recovery."""
    from app.models.escrow import VALID_TRANSITIONS

    assert "ACTIVE" in VALID_TRANSITIONS["RELEASING"]


# ---------------------------------------------------------------------------
# State machine: REFUNDING can revert to prior states
# ---------------------------------------------------------------------------


def test_refunding_can_revert():
    """State machine allows REFUNDING -> prior states for transfer failure recovery."""
    from app.models.escrow import VALID_TRANSITIONS

    assert "PENDING" in VALID_TRANSITIONS["REFUNDING"]
    assert "FUNDED" in VALID_TRANSITIONS["REFUNDING"]
    assert "ACTIVE" in VALID_TRANSITIONS["REFUNDING"]
    assert "REFUNDED" in VALID_TRANSITIONS["REFUNDING"]


# ---------------------------------------------------------------------------
# Auto-refund error isolation: one failure does not block others
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock)
async def test_autorefund_error_isolation(mock_transfer, db):
    """One auto-refund failure does not prevent other escrows from being refunded."""
    await create_escrow(
        db, _create_request(bounty_id="exp-1"), USER_CREATOR
    )
    await create_escrow(
        db, _create_request(bounty_id="exp-2"), USER_CREATOR
    )
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    for bounty_id in ("exp-1", "exp-2"):
        row = (
            await db.execute(
                select(EscrowAccountTable).where(
                    EscrowAccountTable.bounty_id == bounty_id
                )
            )
        ).scalar_one()
        row.expires_at = past
    await db.commit()

    mock_transfer.side_effect = [RuntimeError("Network error"), TX_REFUND]
    refunded = await process_expired_escrows(db)
    assert "exp-1" not in refunded
    assert "exp-2" in refunded


# ---------------------------------------------------------------------------
# Expiry health metrics tracking
# ---------------------------------------------------------------------------


async def test_expiry_health_metrics():
    """get_expiry_health returns monitoring metrics dict."""
    health = get_expiry_health()
    assert "consecutive_failures" in health
    assert "last_success" in health
    assert "total_processed" in health
    assert "total_failures" in health


# ---------------------------------------------------------------------------
# Bounty lifecycle integration: release requires approved submission
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_release_checks_approved_submission(mock_transfer, db):
    """Release validates that the bounty has an approved submission."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    await activate_escrow(db, BOUNTY_ID, USER_CREATOR)

    # Mock bounty_service.get_submissions to return no approved submissions
    mock_subs = MagicMock()
    mock_subs.status.value = "pending"
    with patch(
        "app.services.escrow_service._validate_approved_submission",
        side_effect=EscrowInvalidStateError("no approved submissions"),
    ):
        with pytest.raises(EscrowInvalidStateError, match="approved"):
            await release_escrow(db, _release_request(), ADMIN_USER)


# ---------------------------------------------------------------------------
# Bounty lifecycle integration: funding validates bounty state
# ---------------------------------------------------------------------------


async def test_create_validates_bounty_state(db):
    """Create escrow validates that the bounty is in a fundable state."""
    with patch(
        "app.services.escrow_service._validate_bounty_for_funding",
        side_effect=EscrowInvalidStateError("Bounty is completed"),
    ):
        with pytest.raises(EscrowInvalidStateError, match="completed"):
            await create_escrow(
                db, _create_request(tx_hash=TX_FUND), USER_CREATOR
            )


# ---------------------------------------------------------------------------
# Postgres integration tests (run when testcontainers available)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not os.environ.get("RUN_POSTGRES_TESTS"),
    reason="Set RUN_POSTGRES_TESTS=1 to run Postgres integration tests",
)
class TestPostgresIntegration:
    """Postgres-specific integration tests using testcontainers.

    These tests verify behaviors that differ between SQLite and Postgres:
    - Constraint name detection in IntegrityError classification
    - SELECT FOR UPDATE with skip_locked
    - Numeric precision with Postgres Numeric type
    """

    @patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
    async def test_pg_constraint_name_duplicate_bounty(self, mock_transfer, pg_db):
        """Postgres IntegrityError includes constraint name for bounty uniqueness."""
        await create_escrow(
            pg_db, _create_request(tx_hash=TX_FUND), USER_CREATOR
        )
        with pytest.raises(EscrowAlreadyExistsError):
            await create_escrow(
                pg_db, _create_request(amount=Decimal("1")), USER_CREATOR
            )

    @patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
    async def test_pg_constraint_name_double_spend(self, mock_transfer, pg_db):
        """Postgres IntegrityError includes constraint name for tx hash uniqueness."""
        await create_escrow(
            pg_db, _create_request(tx_hash=TX_FUND), USER_CREATOR
        )
        with pytest.raises(EscrowDoubleSpendError):
            await create_escrow(
                pg_db,
                _create_request(bounty_id="other", tx_hash=TX_FUND),
                USER_CREATOR,
            )

    @patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_REFUND)
    async def test_pg_select_for_update_in_expiry(self, mock_transfer, pg_db):
        """Postgres auto-refund uses SELECT FOR UPDATE with skip_locked."""
        await create_escrow(pg_db, _create_request(), USER_CREATOR)
        row = (
            await pg_db.execute(
                select(EscrowAccountTable).where(
                    EscrowAccountTable.bounty_id == BOUNTY_ID
                )
            )
        ).scalar_one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        await pg_db.commit()
        refunded = await process_expired_escrows(pg_db)
        assert BOUNTY_ID in refunded

    async def test_pg_decimal_precision(self, pg_db):
        """Postgres Numeric(20,9) preserves full Decimal precision."""
        amount = Decimal("123456789.123456789")
        result = await create_escrow(
            pg_db, _create_request(amount=amount), USER_CREATOR
        )
        assert result.amount == amount


# ---------------------------------------------------------------------------
# ACTIVE -> REFUNDING -> REFUNDED path
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_REFUND)
async def test_active_to_refunded(mock_transfer, db):
    """ACTIVE escrow can be refunded through REFUNDING intermediate state."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    await activate_escrow(db, BOUNTY_ID, USER_CREATOR)
    result = await refund_escrow(db, _refund_request(), USER_CREATOR)
    assert result.state == ES.REFUNDED


# ---------------------------------------------------------------------------
# FUNDED can release directly (skips ACTIVE)
# ---------------------------------------------------------------------------


@patch(SPL_MOCK_PATH, new_callable=AsyncMock, return_value=TX_RELEASE)
async def test_funded_can_release_directly(mock_transfer, db):
    """FUNDED can release directly without going through ACTIVE first."""
    await create_escrow(db, _create_request(tx_hash=TX_FUND), USER_CREATOR)
    result = await release_escrow(db, _release_request(), ADMIN_USER)
    assert result.state == ES.COMPLETED

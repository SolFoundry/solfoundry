"""Anti-gaming service helpers (uses in-memory bounty store)."""

from types import SimpleNamespace

from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.services import bounty_service
from app.services.anti_gaming_service import (
    count_active_claims_for_user,
    is_wallet_synthetic_github_user,
    submission_actor_key,
)


def test_submission_actor_key_prefers_wallet():
    sub = SimpleNamespace(contributor_wallet="AbC", submitted_by="alice")
    assert submission_actor_key(sub) == "wallet:abc"


def test_submission_actor_key_falls_back_to_github():
    sub = SimpleNamespace(contributor_wallet=None, submitted_by="Bob")
    assert submission_actor_key(sub) == "gh:bob"


def test_wallet_synthetic_github_user():
    assert is_wallet_synthetic_github_user("wallet_abc")
    assert not is_wallet_synthetic_github_user("12345")


def test_count_active_claims_for_user():
    bid = "test-claim-count-bounty"
    bounty_service._bounty_store[bid] = BountyDB(
        id=bid,
        title="t",
        reward_amount=1.0,
        tier=BountyTier.T2,
        status=BountyStatus.IN_PROGRESS,
        claimed_by="user-a",
    )
    assert count_active_claims_for_user("user-a") >= 1
    del bounty_service._bounty_store[bid]

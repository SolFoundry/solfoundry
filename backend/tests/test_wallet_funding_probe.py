"""Unit tests for Solana funding fingerprint heuristics."""

from app.services.wallet_funding_probe import _pick_funder_for_sol_increase


def test_pick_funder_from_native_sol_transfer():
    wallet = "WALLET1111111111111111111111111111111111"
    funder = "FUNDER222222222222222222222222222222222222"
    tx = {
        "transaction": {
            "message": {"accountKeys": [wallet, funder]},
        },
        "meta": {"preBalances": [100, 900], "postBalances": [200, 800]},
    }
    assert _pick_funder_for_sol_increase(wallet, tx) == funder


def test_pick_funder_no_increase():
    wallet = "WALLET1111111111111111111111111111111111"
    tx = {
        "transaction": {"message": {"accountKeys": [wallet, "OTHER"]}},
        "meta": {"preBalances": [100, 100], "postBalances": [100, 100]},
    }
    assert _pick_funder_for_sol_increase(wallet, tx) is None

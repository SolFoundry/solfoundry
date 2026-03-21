import pytest
from httpx import AsyncClient
from app.main import app
from app.auth.wallet import verify_solana_signature

@pytest.mark.asyncio
async def test_wallet_auth_flow():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Test invalid signature
        response = await ac.post("/auth/wallet", json={
            "wallet_address": "BTMcra29vWEBvrvgoeEyAVtEZ9JUmucRt4VWgyLExzLa",
            "signature": "invalid_sig",
            "message": "Login to SolFoundry"
        })
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_get_me_protected():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Test accessing /auth/me without a token
        response = await ac.get("/auth/me")
        assert response.status_code == 401

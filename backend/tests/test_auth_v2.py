"""Comprehensive tests for authentication service."""

import pytest
import base64
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Test the security-hardened auth functions
def test_oauth_state_generation():
    """Test OAuth state is generated and stored."""
    from app.services.auth_service_v2 import get_github_authorize_url, _oauth_states
    
    url, state = get_github_authorize_url()
    assert state is not None
    assert len(state) > 20
    assert state in _oauth_states
    assert "expires_at" in _oauth_states[state]


def test_oauth_state_verification():
    """Test OAuth state verification."""
    from app.services.auth_service_v2 import get_github_authorize_url, verify_oauth_state, InvalidStateError
    
    _, state = get_github_authorize_url()
    assert verify_oauth_state(state) == True
    
    # State should be removed after verification (no replay)
    with pytest.raises(InvalidStateError):
        verify_oauth_state(state)


def test_oauth_state_missing():
    """Test missing state raises error."""
    from app.services.auth_service_v2 import verify_oauth_state, InvalidStateError
    
    with pytest.raises(InvalidStateError, match="Missing state"):
        verify_oauth_state("")


def test_oauth_state_invalid():
    """Test invalid state raises error."""
    from app.services.auth_service_v2 import verify_oauth_state, InvalidStateError
    
    with pytest.raises(InvalidStateError, match="Invalid state"):
        verify_oauth_state("invalid_nonce_12345")


def test_auth_message_generation():
    """Test auth challenge message generation."""
    from app.services.auth_service_v2 import generate_auth_message, _auth_challenges
    
    wallet = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    result = generate_auth_message(wallet)
    
    assert "message" in result
    assert "nonce" in result
    assert "expires_at" in result
    assert wallet in result["message"]
    assert result["nonce"] in _auth_challenges


def test_auth_challenge_verification():
    """Test auth challenge verification."""
    from app.services.auth_service_v2 import generate_auth_message, verify_auth_challenge
    
    wallet = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    result = generate_auth_message(wallet)
    
    # Should succeed
    assert verify_auth_challenge(result["nonce"], wallet, result["message"]) == True
    
    # Nonce should be removed after use
    from app.services.auth_service_v2 import _auth_challenges
    assert result["nonce"] not in _auth_challenges


def test_auth_challenge_wallet_mismatch():
    """Test auth challenge with wrong wallet."""
    from app.services.auth_service_v2 import generate_auth_message, verify_auth_challenge, InvalidNonceError
    
    wallet = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    wrong_wallet = "DifferentWallet123456789"
    result = generate_auth_message(wallet)
    
    with pytest.raises(InvalidNonceError, match="Wallet mismatch"):
        verify_auth_challenge(result["nonce"], wrong_wallet, result["message"])


def test_auth_challenge_message_mismatch():
    """Test auth challenge with wrong message."""
    from app.services.auth_service_v2 import generate_auth_message, verify_auth_challenge, InvalidNonceError
    
    wallet = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    result = generate_auth_message(wallet)
    
    with pytest.raises(InvalidNonceError, match="Message mismatch"):
        verify_auth_challenge(result["nonce"], wallet, "wrong message")


def test_auth_challenge_invalid_nonce():
    """Test auth challenge with invalid nonce."""
    from app.services.auth_service_v2 import verify_auth_challenge, InvalidNonceError
    
    with pytest.raises(InvalidNonceError, match="Invalid nonce"):
        verify_auth_challenge("invalid_nonce", "wallet", "message")


def test_token_creation():
    """Test JWT token creation."""
    from app.services.auth_service_v2 import create_access_token, create_refresh_token, decode_token
    
    user_id = "test_user_123"
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    
    assert access is not None
    assert refresh is not None
    
    # Decode and verify
    assert decode_token(access, "access") == user_id
    assert decode_token(refresh, "refresh") == user_id


def test_token_wrong_type():
    """Test decoding token with wrong type."""
    from app.services.auth_service_v2 import create_access_token, decode_token, InvalidTokenError
    
    token = create_access_token("user_123")
    
    with pytest.raises(InvalidTokenError, match="Expected refresh"):
        decode_token(token, "refresh")


def test_token_invalid():
    """Test decoding invalid token."""
    from app.services.auth_service_v2 import decode_token, InvalidTokenError
    
    with pytest.raises(InvalidTokenError):
        decode_token("not.a.valid.token", "access")


def test_wallet_signature_invalid_address():
    """Test wallet verification with invalid address."""
    from app.services.auth_service_v2 import verify_wallet_signature, WalletVerificationError
    
    with pytest.raises(WalletVerificationError, match="Invalid wallet address"):
        verify_wallet_signature("short", "message", "signature")


def test_wallet_signature_invalid_length():
    """Test wallet verification with wrong signature length."""
    from app.services.auth_service_v2 import verify_wallet_signature, WalletVerificationError
    
    valid_addr = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    wrong_sig = base64.b64encode(b"x" * 32).decode()  # Should be 64 bytes
    
    with pytest.raises(WalletVerificationError, match="Invalid signature length"):
        verify_wallet_signature(valid_addr, "message", wrong_sig)


def test_unique_token_ids():
    """Test that each token has unique ID."""
    from app.services.auth_service_v2 import create_access_token
    from jose import jwt
    
    token1 = create_access_token("user_123")
    token2 = create_access_token("user_123")
    
    payload1 = jwt.decode(token1, "placeholder", algorithms=["HS256"], options={"verify_signature": False})
    payload2 = jwt.decode(token2, "placeholder", algorithms=["HS256"], options={"verify_signature": False})
    
    assert payload1.get("jti") != payload2.get("jti")


def test_unique_nonces():
    """Test that each auth message has unique nonce."""
    from app.services.auth_service_v2 import generate_auth_message
    
    wallet = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
    
    result1 = generate_auth_message(wallet)
    result2 = generate_auth_message(wallet)
    
    assert result1["nonce"] != result2["nonce"]


def test_wallet_address_normalized():
    """Test wallet address is normalized to lowercase."""
    from app.services.auth_service_v2 import generate_auth_message, _auth_challenges
    
    wallet = "AMU1YJjCKWKL6XuMTODX511KFZXAXGPETJRZP7N71O7"
    result = generate_auth_message(wallet)
    
    # Should be stored lowercase
    assert _auth_challenges[result["nonce"]]["wallet_address"] == wallet.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
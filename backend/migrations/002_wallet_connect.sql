-- Migration 002: Wallet Connect Backend Wiring
-- Creates tables for wallet-to-user linking, session management,
-- authentication challenges, and rate limiting.
--
-- PostgreSQL migration path for bounty #496.

-- Wallet-to-user links table
-- Stores the association between Solana wallets and user accounts.
-- Each wallet address is globally unique (one wallet = one user).
CREATE TABLE IF NOT EXISTS wallet_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'unknown',
    label VARCHAR(128),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallet_links_address UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS ix_wallet_links_user_id ON wallet_links(user_id);
CREATE INDEX IF NOT EXISTS ix_wallet_links_address ON wallet_links(wallet_address);
CREATE INDEX IF NOT EXISTS ix_wallet_links_user_primary ON wallet_links(user_id, is_primary);

-- Authentication sessions table
-- Tracks JWT sessions with revocation support.
-- Each login creates a session; sessions can be revoked individually or in bulk.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(64) NOT NULL UNIQUE,
    refresh_token_id VARCHAR(64) NOT NULL UNIQUE,
    wallet_address VARCHAR(64),
    provider VARCHAR(32) NOT NULL DEFAULT 'unknown',
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_token_id ON auth_sessions(token_id);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_refresh_token_id ON auth_sessions(refresh_token_id);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_status ON auth_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires ON auth_sessions(expires_at);

-- Authentication challenges table
-- Stores SIWS nonce challenges for wallet signature verification.
-- Challenges are single-use and expire after 5 minutes.
CREATE TABLE IF NOT EXISTS auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce VARCHAR(64) NOT NULL UNIQUE,
    wallet_address VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_auth_challenges_nonce ON auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS ix_auth_challenges_expires ON auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS ix_auth_challenges_wallet ON auth_challenges(wallet_address);

-- Rate limiting table
-- Tracks per-IP and per-wallet auth attempts with sliding windows.
-- Enforces 5 attempts per minute on auth endpoints.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(128) NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rate_limits_identifier ON auth_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS ix_rate_limits_attempt ON auth_rate_limits(attempt_at);
CREATE INDEX IF NOT EXISTS ix_rate_limits_identifier_endpoint ON auth_rate_limits(identifier, endpoint);

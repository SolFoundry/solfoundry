-- Migration: Add bounty_boosts table for the boost mechanism
-- Issue: #510 — Bounty Boost Mechanism
-- Description: Allows community members to boost bounty rewards by adding
--              their own $FNDRY to the prize pool.

CREATE TABLE IF NOT EXISTS bounty_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id UUID NOT NULL,
    booster_user_id UUID NOT NULL,
    booster_wallet VARCHAR(64) NOT NULL,
    amount NUMERIC(20, 6) NOT NULL CHECK (amount >= 1000),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'refunded', 'pending_refund')),
    escrow_tx_hash VARCHAR(128) UNIQUE,
    refund_tx_hash VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    refunded_at TIMESTAMPTZ,
    message TEXT
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS ix_boosts_bounty_status
    ON bounty_boosts (bounty_id, status);

CREATE INDEX IF NOT EXISTS ix_boosts_bounty_amount
    ON bounty_boosts (bounty_id, amount);

CREATE INDEX IF NOT EXISTS ix_boosts_user_bounty
    ON bounty_boosts (booster_user_id, bounty_id);

-- Foreign key to bounties table (deferred — bounties may use UUID or text IDs)
-- In production, uncomment once bounties table is confirmed UUID-primary:
-- ALTER TABLE bounty_boosts
--     ADD CONSTRAINT fk_boosts_bounty
--     FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE;

COMMENT ON TABLE bounty_boosts IS 'Community boost contributions to bounty reward pools';
COMMENT ON COLUMN bounty_boosts.amount IS 'Boost amount in $FNDRY (minimum 1,000)';
COMMENT ON COLUMN bounty_boosts.escrow_tx_hash IS 'Solana transaction hash for escrow deposit';
COMMENT ON COLUMN bounty_boosts.refund_tx_hash IS 'Solana transaction hash for refund (if applicable)';

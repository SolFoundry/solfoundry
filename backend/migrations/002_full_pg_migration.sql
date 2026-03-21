-- Migration 002: Full PostgreSQL persistence tables (Issue #162).
-- Idempotent — safe to re-run.  All tables use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS payouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient       VARCHAR(100) NOT NULL,
    recipient_wallet VARCHAR(64),
    amount          DOUBLE PRECISION NOT NULL,
    token           VARCHAR(20) DEFAULT 'FNDRY',
    bounty_id       VARCHAR(64),
    bounty_title    VARCHAR(200),
    tx_hash         VARCHAR(128) UNIQUE,
    status          VARCHAR(20) DEFAULT 'pending',
    solscan_url     VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_payouts_recipient ON payouts(recipient);

CREATE TABLE IF NOT EXISTS buybacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount_sol      DOUBLE PRECISION NOT NULL,
    amount_fndry    DOUBLE PRECISION NOT NULL,
    price_per_fndry DOUBLE PRECISION NOT NULL,
    tx_hash         VARCHAR(128) UNIQUE,
    solscan_url     VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_history (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id       VARCHAR(64) NOT NULL,
    bounty_id            VARCHAR(64) NOT NULL,
    bounty_title         VARCHAR(200) NOT NULL,
    bounty_tier          INTEGER NOT NULL,
    review_score         DOUBLE PRECISION NOT NULL,
    earned_reputation    DOUBLE PRECISION DEFAULT 0,
    anti_farming_applied BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_rep_cid_bid
    ON reputation_history(contributor_id, bounty_id);

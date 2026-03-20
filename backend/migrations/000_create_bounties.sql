-- Migration 000: Create bounties and submissions tables
-- PostgreSQL schema for the Bounty CRUD API (Issue #3)
--
-- Run this migration before 001_add_bounty_search.sql.
-- Requires: PostgreSQL 14+ (for gen_random_uuid).

BEGIN;

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE bounty_tier AS ENUM ('1', '2', '3');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE bounty_status AS ENUM ('open', 'in_progress', 'completed', 'paid');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Bounties table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bounties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(200)    NOT NULL CHECK (char_length(title) >= 3),
    description     TEXT            NOT NULL DEFAULT '',
    tier            bounty_tier     NOT NULL DEFAULT '2',
    reward_amount   NUMERIC(12, 2)  NOT NULL CHECK (reward_amount >= 0.01 AND reward_amount <= 1000000),
    status          bounty_status   NOT NULL DEFAULT 'open',
    github_issue_url TEXT,
    required_skills TEXT[]          NOT NULL DEFAULT '{}',
    deadline        TIMESTAMPTZ,
    created_by      VARCHAR(100)    NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE bounties IS 'Bounty tasks with reward tiers and lifecycle status.';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS ix_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS ix_bounties_tier ON bounties(tier);
CREATE INDEX IF NOT EXISTS ix_bounties_created_at ON bounties(created_at DESC);

-- ---------------------------------------------------------------------------
-- Submissions table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id       UUID            NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    pr_url          TEXT            NOT NULL,
    submitted_by    VARCHAR(100)    NOT NULL,
    notes           TEXT,
    submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Prevent duplicate PR submissions on the same bounty
    CONSTRAINT uq_submissions_bounty_pr UNIQUE (bounty_id, pr_url)
);

COMMENT ON TABLE submissions IS 'Pull request submissions linked to bounties.';

CREATE INDEX IF NOT EXISTS ix_submissions_bounty_id ON submissions(bounty_id);
CREATE INDEX IF NOT EXISTS ix_submissions_submitted_by ON submissions(submitted_by);

-- ---------------------------------------------------------------------------
-- Auto-update updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bounties_updated_at ON bounties;
CREATE TRIGGER trg_bounties_updated_at
    BEFORE UPDATE ON bounties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

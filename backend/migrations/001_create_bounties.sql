-- Bounty CRUD Schema Migration (Issue #3)

DO $$ BEGIN
    CREATE TYPE bounty_status AS ENUM ('open', 'in_progress', 'completed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bounties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(200)    NOT NULL,
    description     TEXT            NOT NULL DEFAULT '',
    tier            SMALLINT        NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
    reward_amount   NUMERIC(18,2)   NOT NULL CHECK (reward_amount > 0),
    status          VARCHAR(20)     NOT NULL DEFAULT 'open',
    github_issue_url VARCHAR(500),
    required_skills TEXT[]          NOT NULL DEFAULT '{}',
    deadline        TIMESTAMPTZ,
    min_reputation  INTEGER,
    created_by      VARCHAR(100)    NOT NULL DEFAULT 'system',
    active_claim_id UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bounty_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id       UUID            NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    pr_url          VARCHAR(500)    NOT NULL,
    submitted_by    VARCHAR(100)    NOT NULL,
    notes           TEXT,
    submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (bounty_id, pr_url)
);

CREATE TABLE IF NOT EXISTS bounty_claims (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id         UUID            NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    contributor_id    VARCHAR(100)    NOT NULL,
    status            VARCHAR(20)     NOT NULL DEFAULT 'active',
    application_text  TEXT,
    claimed_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deadline          TIMESTAMPTZ,
    released_at       TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties (status);
CREATE INDEX IF NOT EXISTS idx_bounties_tier ON bounties (tier);
CREATE INDEX IF NOT EXISTS idx_bounties_created_at ON bounties (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounties_skills ON bounties USING GIN (required_skills);
CREATE INDEX IF NOT EXISTS idx_submissions_bounty_id ON bounty_submissions (bounty_id);
CREATE INDEX IF NOT EXISTS idx_claims_bounty_id ON bounty_claims (bounty_id);
CREATE INDEX IF NOT EXISTS idx_claims_contributor ON bounty_claims (contributor_id);

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_bounties_updated_at ON bounties;
CREATE TRIGGER trig_bounties_updated_at BEFORE UPDATE ON bounties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

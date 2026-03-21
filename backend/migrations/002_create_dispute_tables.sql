-- Migration: Create dispute resolution tables
-- Implements: OPENED → EVIDENCE → MEDIATION → RESOLVED lifecycle

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── disputes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bounty_id       UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    submission_id   VARCHAR(36) NOT NULL,
    contributor_id  VARCHAR(100) NOT NULL,
    creator_id      VARCHAR(100) NOT NULL,

    reason          VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,

    status          VARCHAR(20) NOT NULL DEFAULT 'opened',
    outcome         VARCHAR(30),
    mediation_type  VARCHAR(10),

    -- AI mediation
    ai_score            FLOAT,
    ai_review_summary   TEXT,
    ai_auto_resolved    BOOLEAN NOT NULL DEFAULT FALSE,

    -- Resolution
    resolver_id         VARCHAR(100),
    resolution_notes    TEXT,
    split_percentage    FLOAT,

    -- Reputation deltas
    contributor_rep_delta   FLOAT NOT NULL DEFAULT 0.0,
    creator_rep_delta       FLOAT NOT NULL DEFAULT 0.0,

    -- Timing
    rejection_at    TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT chk_dispute_status CHECK (status IN ('opened', 'evidence', 'mediation', 'resolved')),
    CONSTRAINT chk_dispute_outcome CHECK (outcome IS NULL OR outcome IN ('release_to_contributor', 'refund_to_creator', 'split')),
    CONSTRAINT chk_mediation_type CHECK (mediation_type IS NULL OR mediation_type IN ('ai', 'manual')),
    CONSTRAINT chk_split_pct CHECK (split_percentage IS NULL OR (split_percentage >= 0 AND split_percentage <= 100))
);

CREATE INDEX IF NOT EXISTS ix_disputes_bounty_id ON disputes(bounty_id);
CREATE INDEX IF NOT EXISTS ix_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS ix_disputes_contributor_id ON disputes(contributor_id);
CREATE INDEX IF NOT EXISTS ix_disputes_creator_id ON disputes(creator_id);
CREATE INDEX IF NOT EXISTS ix_disputes_created_at ON disputes(created_at DESC);

-- ── dispute_evidence ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dispute_evidence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    submitted_by    VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL,
    evidence_type   VARCHAR(30) NOT NULL,
    url             VARCHAR(2000),
    explanation     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_evidence_role CHECK (role IN ('contributor', 'creator')),
    CONSTRAINT chk_evidence_type CHECK (evidence_type IN ('link', 'text', 'screenshot'))
);

CREATE INDEX IF NOT EXISTS ix_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);

-- ── dispute_history (audit trail) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dispute_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    action          VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status      VARCHAR(20),
    actor_id        VARCHAR(100) NOT NULL,
    actor_role      VARCHAR(20),
    notes           TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dispute_history_dispute_id ON dispute_history(dispute_id);
CREATE INDEX IF NOT EXISTS ix_dispute_history_created_at ON dispute_history(created_at DESC);

-- ── Auto-update updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disputes_updated_at ON disputes;
CREATE TRIGGER disputes_updated_at
    BEFORE UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_disputes_updated_at();

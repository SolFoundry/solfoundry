-- SolFoundry Treasury Database Schema

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    token VARCHAR(10) NOT NULL,
    description TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    allocated DECIMAL(20, 8) NOT NULL,
    spent DECIMAL(20, 8) DEFAULT 0,
    currency VARCHAR(10) NOT NULL,
    period VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bounties table
CREATE TABLE IF NOT EXISTS bounties (
    id VARCHAR(50) PRIMARY KEY,
    issue_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    reward DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    claimed_by VARCHAR(100),
    submitted_at TIMESTAMPTZ,
    merged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);

-- Insert sample data
INSERT INTO transactions (id, type, amount, token, description, timestamp, status) VALUES
    ('tx_001', 'inflow', 50000, 'USDT', 'Q1 2026 Funding', '2026-03-20 10:00:00+00', 'completed'),
    ('tx_002', 'outflow', 250000, 'FNDRY', 'Bounty #604 Payout - TypeScript SDK', '2026-03-23 01:30:00+00', 'completed'),
    ('tx_003', 'outflow', 250000, 'FNDRY', 'Bounty #606 Payout - Deployment Automation', '2026-03-23 02:00:00+00', 'completed');

INSERT INTO budgets (id, name, category, allocated, spent, currency, period, status) VALUES
    ('budget_001', 'T1 Bounties', 'development', 500000, 325000, 'FNDRY', 'Q1 2026', 'active'),
    ('budget_002', 'T2 Bounties', 'development', 2000000, 1100000, 'FNDRY', 'Q1 2026', 'active'),
    ('budget_003', 'Infrastructure', 'operations', 50000, 32000, 'USDT', 'Q1 2026', 'active'),
    ('budget_004', 'Marketing', 'growth', 100000, 45000, 'USDT', 'Q1 2026', 'active'),
    ('budget_005', 'Community Rewards', 'community', 250000, 180000, 'FNDRY', 'Q1 2026', 'active');

INSERT INTO bounties (id, issue_number, title, reward, currency, status, claimed_by, submitted_at) VALUES
    ('bounty_001', 604, 'TypeScript SDK', 250000, 'FNDRY', 'merged', 'zhuzhushiwojia', '2026-03-23 01:00:00+00'),
    ('bounty_002', 606, 'Deployment Automation', 250000, 'FNDRY', 'merged', 'zhuzhushiwojia', '2026-03-23 01:30:00+00'),
    ('bounty_003', 508, 'Webhooks', 275000, 'FNDRY', 'pending_review', 'zhuzhushiwojia', '2026-03-22 10:00:00+00'),
    ('bounty_004', 501, 'Treasury Dashboard', 275000, 'FNDRY', 'submitted', 'zhuzhushiwojia', '2026-03-23 18:00:00+00');

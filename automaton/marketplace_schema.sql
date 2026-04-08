-- Marketplace schema for SolFoundry
-- SQLite

CREATE TABLE IF NOT EXISTS marketplace_repos (
    id                TEXT PRIMARY KEY,
    github_id         INTEGER NOT NULL UNIQUE,
    name              TEXT NOT NULL DEFAULT '',
    full_name         TEXT NOT NULL DEFAULT '',
    description       TEXT,
    language          TEXT,
    stars             INTEGER NOT NULL DEFAULT 0,
    owner_login       TEXT NOT NULL DEFAULT '',
    owner_avatar_url  TEXT,
    html_url          TEXT NOT NULL DEFAULT '',
    total_funded_usdc REAL NOT NULL DEFAULT 0,
    total_funded_fndry REAL NOT NULL DEFAULT 0,
    active_goals      INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repos_github_id ON marketplace_repos(github_id);
CREATE INDEX IF NOT EXISTS idx_repos_language  ON marketplace_repos(language);
CREATE INDEX IF NOT EXISTS idx_repos_stars     ON marketplace_repos(stars);

CREATE TABLE IF NOT EXISTS funding_goals (
    id                  TEXT PRIMARY KEY,
    repo_id             TEXT NOT NULL REFERENCES marketplace_repos(id) ON DELETE CASCADE,
    creator_id          TEXT NOT NULL DEFAULT '',
    creator_username    TEXT,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    target_amount       REAL NOT NULL,
    target_token        TEXT NOT NULL CHECK(target_token IN ('USDC', 'FNDRY')),
    current_amount      REAL NOT NULL DEFAULT 0,
    contributor_count   INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled', 'distributed')),
    deadline            TEXT,
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_repo_id ON funding_goals(repo_id);
CREATE INDEX IF NOT EXISTS idx_goals_status  ON funding_goals(status);

CREATE TABLE IF NOT EXISTS contributions (
    id                    TEXT PRIMARY KEY,
    goal_id               TEXT NOT NULL REFERENCES funding_goals(id) ON DELETE CASCADE,
    contributor_id        TEXT NOT NULL DEFAULT '',
    contributor_username  TEXT,
    amount                REAL NOT NULL,
    token                 TEXT NOT NULL CHECK(token IN ('USDC', 'FNDRY')),
    tx_signature          TEXT,
    created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contributions_goal_id        ON contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_contributions_contributor_id ON contributions(contributor_id);

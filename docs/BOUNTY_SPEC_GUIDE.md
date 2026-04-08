# How to Write a Bounty Spec

This guide explains how to write a bounty specification that passes validation and produces a well-structured bounty issue.

## Spec Format

Bounty specs are YAML documents with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | All tiers | Short descriptive title (3-200 chars) |
| `description` | string | All tiers | Detailed description of the bounty |
| `tier` | integer | All tiers | Difficulty tier: 1, 2, or 3 |
| `reward` | number | All tiers | Reward in $FNDRY tokens |
| `requirements` | list | T2, T3 | Acceptance criteria (checkboxes) |
| `category` | string | All tiers | One of the valid categories |
| `deadline` | datetime | T2, T3 | ISO 8601 deadline (must be future) |
| `skills` | list | Optional | Required skills/technologies |
| `github_issue_url` | string | Optional | Link to existing GitHub issue |
| `created_by` | string | Optional | Spec author (defaults to 'system') |

## Valid Categories

- `smart-contract` — Solana/Anchor program work
- `frontend` — React/TypeScript UI work
- `backend` — FastAPI/Python server work
- `design` — UI/UX design
- `content` — Documentation, tutorials, marketing
- `security` — Audits, vulnerability fixes
- `devops` — CI/CD, deployment, infrastructure
- `documentation` — Technical documentation

## Tier Rules

### Tier 1 — Starter (50,000 - 200,000 $FNDRY)

- **Required fields:** title, description, tier, reward, category
- **Min description length:** 20 characters
- **Requirements:** Optional
- **Deadline:** Optional
- **Review threshold:** 6.0/10

### Tier 2 — Intermediate (200,001 - 500,000 $FNDRY)

- **Required fields:** title, description, tier, reward, requirements, category, deadline
- **Min description length:** 50 characters
- **Min requirements:** 2
- **Deadline:** Required (must be in the future)
- **Review threshold:** 6.5/10

### Tier 3 — Advanced (500,001 - 1,000,000 $FNDRY)

- **Required fields:** title, description, tier, reward, requirements, category, deadline
- **Min description length:** 100 characters
- **Min requirements:** 3
- **Deadline:** Required (must be in the future)
- **Review threshold:** 7.0/10

## Example Specs

### Tier 1 Example

```yaml
title: "Fix typo in README contributing section"
description: >
  The CONTRIBUTING.md file has a typo in the setup instructions.
  The command `npm instal` should be `npm install`. Fix the typo
  and verify the instructions work end-to-end.
tier: 1
reward: 100000
category: documentation
skills:
  - documentation
```

### Tier 2 Example

```yaml
title: "Bounty spec templates + CI validation"
description: >
  Create bounty specification templates and a CI validation pipeline
  that ensures all bounty issues meet quality standards before going live.
  Includes YAML spec format, tier-specific templates, a spec linter CLI,
  batch creation scripts, and comprehensive tests.
tier: 2
reward: 300000
category: devops
deadline: "2026-04-01T23:59:59Z"
requirements:
  - "YAML bounty spec format with required fields"
  - "Templates for each tier"
  - "CI validation workflow config"
  - "Reward-within-tier-range checks"
  - "Auto-labels from spec (tier, category)"
  - "Spec linter CLI"
  - "Batch creation script"
  - "Documentation on writing bounty specs"
  - "Tests for validation logic"
skills:
  - python
  - devops
```

### Tier 3 Example

```yaml
title: "Multi-agent bounty review pipeline"
description: >
  Build a production-grade multi-LLM review pipeline that scores bounty
  PR submissions across 6 quality dimensions. Must support GPT-5.4,
  Gemini 3.1 Pro, and Grok 4 with configurable weights. Includes
  consensus algorithm, outlier dampening, and a dashboard view.
tier: 3
reward: 750000
category: backend
deadline: "2026-04-15T23:59:59Z"
requirements:
  - "Multi-LLM review endpoint"
  - "Scoring across 6 dimensions"
  - "Consensus algorithm with outlier dampening"
  - "Per-tier auto-merge thresholds"
  - "Retry logic with exponential backoff"
  - "Review results dashboard component"
  - "PostgreSQL persistence"
  - "Tests with mocked LLM responses"
skills:
  - python
  - fastapi
  - react
  - postgresql
```

## Validation

### CLI Linter

```bash
# Validate a single spec
python3 scripts/lint-bounty.py bounty.yaml

# JSON output for CI
python3 scripts/lint-bounty.py bounty.yaml --json
```

### Batch Creation

```bash
# Create bounties from all specs in a directory
python3 scripts/create-bounties.py specs/

# Dry-run (validate only)
python3 scripts/create-bounties.py specs/ --dry-run

# JSON output
python3 scripts/create-bounties.py specs/ --json
```

### API Endpoints

```bash
# Validate a spec (dry-run)
curl -X POST http://localhost:8000/api/bounty-specs/validate \
  -H "Content-Type: application/json" \
  -d '{"title":"My Bounty","description":"Description here","tier":2,"reward":300000,"category":"backend","requirements":["Req 1","Req 2"],"deadline":"2026-04-01T23:59:59Z"}'

# Get templates
curl http://localhost:8000/api/bounty-specs/templates

# Create a bounty from spec (requires auth)
curl -X POST http://localhost:8000/api/bounty-specs/create \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{"title":"My Bounty","description":"Description here","tier":2,"reward":300000,"category":"backend","requirements":["Req 1","Req 2"],"deadline":"2026-04-01T23:59:59Z"}'
```

## CI Integration

The CI validation workflow is defined in `docs/ci-bounty-validation.yaml`. When activated, it:

1. Triggers on issue creation/edit for issues with the `bounty` label
2. Extracts the YAML spec block from the issue body
3. Runs the spec linter
4. Auto-labels valid issues with tier and category labels
5. Comments validation errors on invalid specs

To activate, a repository admin copies the workflow into `.github/workflows/`.

## Auto-Labels

The validation pipeline auto-generates labels from the spec:

- `bounty` — always applied
- `tier-1`, `tier-2`, or `tier-3` — based on tier field
- Category label (e.g., `backend`, `frontend`, `devops`)
- Skill labels for well-known technologies (e.g., `python`, `react`)

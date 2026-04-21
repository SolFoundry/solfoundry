# SolFoundry Bounty Creator 🏭

A GitHub Action that automatically converts labeled GitHub issues into [SolFoundry](https://solfoundry.com) bounties with customizable reward amounts, tiers, and deadlines.

## Features

- ✅ **Label-triggered bounty creation** — Add a `bounty` label to any issue to create a SolFoundry bounty
- ✅ **Tier detection** — Automatically sets tier via `tier-1`, `tier-2`, `tier-3` labels
- ✅ **Custom reward amounts** — Set via label (`reward-500k`) or issue body (`reward: 250000 FNDRY`)
- ✅ **Skill extraction** — Auto-detects skills from labels (`frontend`, `backend`, `docs`, etc.)
- ✅ **Dry-run mode** — Test without creating actual bounties
- ✅ **Auto-comment** — Posts bounty link back to the issue

## Quick Start

### 1. Get your SolFoundry API key

Generate an API key from your [SolFoundry account settings](https://solfoundry.com/settings).

### 2. Create a workflow file

```yaml
# .github/workflows/bounty-creator.yml
name: Create SolFoundry Bounty

on:
  issues:
    types: [labeled]

jobs:
  create-bounty:
    runs-on: ubuntu-latest
    # Only run when a bounty label is added
    if: contains(github.event.label.name, 'bounty')
    steps:
      - uses: SolFoundry/solfoundry-bounty-action@v1
        with:
          api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          # Optional: customize defaults
          # bounty-label: 'bounty'
          # reward-amount: '100000'
          # tier: 'T2'
          # deadline-days: '30'
```

### 3. Use it!

1. Create a new issue
2. Add the `bounty` label
3. The action automatically creates a bounty on SolFoundry
4. A comment with the bounty link is posted on the issue

## Configuration

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ Yes | — | SolFoundry API key |
| `solfoundry-api-url` | No | `https://solfoundry.com/api` | SolFoundry API base URL |
| `bounty-label` | No | `bounty` | Label that triggers bounty creation |
| `reward-amount` | No | `100000` | Default reward in FNDRY tokens |
| `reward-token` | No | `FNDRY` | Reward token (`FNDRY` or `USDC`) |
| `tier` | No | `T2` | Default bounty tier (`T1`, `T2`, `T3`) |
| `deadline-days` | No | `30` | Days until bounty deadline |
| `dry-run` | No | `false` | Run without creating bounty |

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | ID of the created bounty |
| `bounty-url` | URL to the bounty on SolFoundry |
| `status` | `success`, `skipped`, or `failed` |

## Advanced Usage

### Tier-based Rewards

Set the tier using labels. Rewards default to:
- `tier-1` → 500K FNDRY (simple fixes, docs)
- `tier-2` → 500K FNDRY (features, integrations)
- `tier-3` → 1M FNDRY (complex features)

```yaml
# Example: T3 bounty for a complex feature
steps:
  - uses: SolFoundry/solfoundry-bounty-action@v1
    with:
      api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
      tier: 'T3'
```

### Custom Reward Amount

Override the reward in two ways:

**Via label:**
```
bounty, tier-3, reward-750k, frontend
```

**Via issue body:**
```markdown
## Feature Request: Dark Mode

Please implement a dark mode toggle.

Reward: 250000 FNDRY
```

### Skill Labels

These labels are automatically mapped to bounty skills:
- `frontend`, `backend`, `docs`, `creative`, `integration`, `agent`, `marketplace`

### Multiple Bounty Workflows

```yaml
# Separate workflows for different bounty types
name: Quick Fix Bounty (T1)
on:
  issues:
    types: [labeled]
jobs:
  create:
    if: contains(github.event.label.name, 'bounty-t1')
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry-bounty-action@v1
        with:
          api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          tier: 'T1'
          reward-amount: '500000'
          deadline-days: '14'

---

name: Feature Bounty (T2)
on:
  issues:
    types: [labeled]
jobs:
  create:
    if: contains(github.event.label.name, 'bounty-t2')
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry-bounty-action@v1
        with:
          api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          tier: 'T2'
          reward-amount: '500000'
          deadline-days: '30'
```

### Dry-run Testing

Test your setup without creating actual bounties:

```yaml
on:
  workflow_dispatch:
    inputs:
      test-issue:
        description: 'Issue number to test'
        required: true

jobs:
  dry-run:
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry-bounty-action@v1
        with:
          api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          dry-run: 'true'
```

## Example Issue Workflow

1. Developer creates an issue: "Add pagination to user list"
2. Maintainer adds labels: `bounty`, `tier-2`, `backend`
3. GitHub Action triggers:
   - Detects `bounty` label ✓
   - Detects `tier-2` → 500K FNDRY reward ✓
   - Extracts `backend` skill ✓
   - Creates bounty on SolFoundry ✓
   - Posts comment: "🏭 Bounty Created! [View on SolFoundry]"
4. Contributors can now submit PRs for the bounty

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT

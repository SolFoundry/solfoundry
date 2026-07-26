# SolFoundry External Bounty GitHub Action

A GitHub Action that automatically posts labeled issues from **any repository** as
bounties on the [SolFoundry](https://solfoundry.dev) marketplace.

## How It Works

1. **Install** the workflow in your repository (see below)
2. **Label** an issue with a bounty label (e.g., `bounty-t1`)
3. **Automatically** — the action detects the label, creates a bounty on SolFoundry,
   and comments on the issue with the bounty link

## Setup

### 1. Add your SolFoundry API Key

Add a repository secret:

| Secret Name | Value |
|---|---|
| `SOLFOUNDRY_API_KEY` | Your SolFoundry API key (get one at [solfoundry.dev](https://solfoundry.dev)) |

### 2. Create the workflow file

Copy `.github/workflows/external-bounty.yml` into your repository's
`.github/workflows/` directory.

### 3. Create labels

Create these labels in your repository (or customize the names):

| Label | Description |
|---|---|
| `bounty-t1` | Tier 1: Simple tasks (small reward) |
| `bounty-t2` | Tier 2: Moderate complexity |
| `bounty-t3` | Tier 3: Large features (large reward) |

## Configuration

All inputs are optional except `solfoundry-api-key`:

| Input | Default | Description |
|---|---|---|
| `solfoundry-api-key` | *required* | SolFoundry API key |
| `bounty-labels` | `bounty-t1,bounty-t2,bounty-t3` | Comma-separated labels for T1, T2, T3 |
| `reward-tier-1` | `50000` | Reward in $FNDRY for T1 |
| `reward-tier-2` | `500000` | Reward in $FNDRY for T2 |
| `reward-tier-3` | `5000000` | Reward in $FNDRY for T3 |

## Example: Custom Configuration

```yaml
- name: Post Bounty
  uses: SolFoundry/solfoundry/.github/actions/post-bounty@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    bounty-labels: "bug-bounty,feature-bounty,security-bounty"
    reward-tier-1: "100000"
    reward-tier-2: "1000000"
    reward-tier-3: "10000000"
```

## Outputs

| Output | Description |
|---|---|
| `bounty-id` | UUID of the created bounty |
| `bounty-url` | URL to view the bounty on SolFoundry |
| `tier` | Tier of the created bounty (1, 2, or 3) |

## Development

```bash
# Run tests
python3 -m pytest .github/actions/post-bounty/

# Lint
python3 -m flake8 .github/actions/post-bounty/
```
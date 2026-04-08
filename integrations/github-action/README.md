# SolFoundry GitHub Action

Automatically post bounties to [SolFoundry](https://solfoundry.vercel.app) when GitHub issues are labeled.

## Quick Start

```yaml
name: Post Bounty
on:
  issues:
    types: [labeled]

jobs:
  bounty:
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/integrations/github-action@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-key` | ✅ | — | Your SolFoundry API key |
| `solfoundry-api-url` | ❌ | `https://solfoundry.vercel.app` | SolFoundry API base URL |
| `default-reward-amount` | ❌ | `100` | Default reward amount |
| `default-reward-token` | ❌ | `USDC` | Default reward token (`USDC` or `FNDRY`) |
| `default-tier` | ❌ | `T1` | Default bounty tier (`T1`, `T2`, `T3`) |
| `bounty-label` | ❌ | `bounty` | Label that triggers bounty creation |
| `github-token` | ❌ | `${{ github.token }}` | Token for posting comments |

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | ID of the created bounty |
| `bounty-url` | URL to the created bounty on SolFoundry |

## Label-Based Configuration

Override defaults using labels on the issue:

| Label | Effect |
|-------|--------|
| `bounty` | Triggers bounty creation (default label) |
| `bounty:$200` | Sets reward to 200 (default token) |
| `bounty:500FNDRY` | Sets reward to 500 FNDRY |
| `bounty-tier:T2` | Sets bounty tier to T2 |

### Examples

**Fixed reward per issue:**
```yaml
- uses: SolFoundry/solfoundry/integrations/github-action@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    default-reward-amount: '250'
    default-reward-token: 'FNDRY'
    default-tier: 'T2'
```

**Per-issue reward via labels:**
```yaml
- uses: SolFoundry/solfoundry/integrations/github-action@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```
Then add labels like `bounty:$500` and `bounty-tier:T3` on each issue.

## Multi-Repo Setup

1. Create a SolFoundry API key at [solfoundry.vercel.app](https://solfoundry.vercel.app)
2. Add `SOLFOUNDRY_API_KEY` as a repository or organization secret
3. Copy the workflow file to each repo's `.github/workflows/` directory
4. Label issues with `bounty` to trigger automatic bounty creation

## How It Works

1. The action triggers on the `issues: labeled` event
2. It checks if the added label matches the configured `bounty-label`
3. It parses optional reward/tier overrides from other labels
4. It calls the SolFoundry API to create the bounty
5. It posts a comment on the issue with the bounty link

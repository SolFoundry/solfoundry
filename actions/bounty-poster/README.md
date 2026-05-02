# SolFoundry Bounty Poster Action

A GitHub Action that automatically converts labeled GitHub issues into SolFoundry bounties with customizable reward amounts.

## Features

- 🔍 **Label Detection** — Automatically detects when an issue gets the `bounty` label
- 💰 **Customizable Reward Tiers** — Map labels to different reward amounts
- 🔧 **Simple YAML Configuration** — Easy setup in your workflow file
- 🧪 **Dry Run Mode** — Test without posting to SolFoundry

## Usage

Add this workflow to your repository at `.github/workflows/bounty-poster.yml`:

```yaml
name: Post Bounty to SolFoundry

on:
  issues:
    types: [labeled, opened]

jobs:
  post-bounty:
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-url: 'https://api.solfoundry.com'
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty'
          default-reward: '200000'
          reward-tiers: '{"tier-1":"200000","tier-2":"450000","tier-3":"850000"}'
          dry-run: 'false'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `solfoundry-api-url` | SolFoundry API endpoint | Yes | `https://api.solfoundry.com` |
| `solfoundry-api-key` | API key for authentication | Yes | — |
| `bounty-label` | Label that triggers bounty posting | No | `bounty` |
| `default-reward` | Default reward in $FNDRY | No | `200000` |
| `reward-tiers` | JSON mapping of tier labels to rewards | No | See action.yml |
| `dry-run` | Log actions without posting | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | The ID of the posted bounty |
| `bounty-url` | The URL of the posted bounty on SolFoundry |

## Reward Tier Example

Configure different reward amounts for different tiers:

```yaml
reward-tiers: |
  {
    "tier-1": "200000",
    "tier-2": "450000",
    "tier-3": "850000"
  }
```

When an issue has both `bounty` and `tier-2` labels, it will be posted with 450K $FNDRY reward.

## License

MIT

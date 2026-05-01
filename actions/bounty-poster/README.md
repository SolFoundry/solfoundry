# SolFoundry Bounty Poster Action

A GitHub Action that automatically converts labeled GitHub issues into SolFoundry bounties with customizable reward amounts.

## Features

- 🔍 **Label Detection** — Auto-detects when an issue gets the `bounty` label
- 💰 **Customizable Reward Tiers** — Maps `tier-1`/`tier-2`/`tier-3` labels to reward amounts
- 🔧 **Simple YAML Configuration** — Easy setup in your workflow file
- 🧪 **Dry Run Mode** — Test without posting to SolFoundry API
- 🔒 **Secure** — API key stored in GitHub Secrets, never in code

## Usage

```yaml
name: Post Bounty to SolFoundry
on:
  issues:
    types: [labeled, opened]

jobs:
  post-bounty:
    if: contains(github.event.issue.labels.*.name, 'bounty')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/bounty-poster
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          reward-tiers: '{"tier-1":"200000","tier-2":"450000","tier-3":"850000"}'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-url` | Yes | `https://api.solfoundry.com` | API endpoint |
| `solfoundry-api-key` | Yes | — | API key (use Secrets) |
| `bounty-label` | No | `bounty` | Trigger label |
| `default-reward` | No | `200000` | Default $FNDRY |
| `reward-tiers` | No | See defaults | Tier→reward JSON |
| `dry-run` | No | `false` | Test mode |

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | Posted bounty ID |
| `bounty-url` | Bounty URL on SolFoundry |

## License

MIT

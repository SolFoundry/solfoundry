# SolFoundry Post Bounty Action

A GitHub Action that external repositories can install to automatically convert labeled GitHub issues into SolFoundry bounties with customizable reward amounts.

## Usage

Create `.github/workflows/post-bounty.yml` in your repository:

```yaml
name: Post Bounty to SolFoundry

on:
  issues:
    types: [opened, labeled]

jobs:
  post-bounty:
    if: contains(github.event.issue.labels.*.name, 'bounty')
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/actions/post-bounty@main
        with:
          solfoundry-api-url: 'https://api.solfoundry.io'
          solfoundry-api-token: ${{ secrets.SOLFOUNDRY_API_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          default-reward: '50'
          reward-label-pattern: 'reward:(\d+)'
          tier: '2'
          labels: 'bounty'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-url` | Yes | `https://api.solfoundry.io` | SolFoundry API URL |
| `solfoundry-api-token` | Yes | - | SolFoundry API auth token |
| `github-token` | Yes | - | GitHub token for API calls |
| `default-reward` | No | `50` | Default reward amount in $FNDRY |
| `reward-label-pattern` | No | `reward:(\d+)` | Regex to extract reward from labels |
| `tier` | No | `2` | Default bounty tier (1, 2, or 3) |
| `labels` | No | `bounty` | Comma-separated labels that trigger posting |

## Example

```yaml
name: Post Bounty to SolFoundry
on:
  issues:
    types: [opened, labeled]
jobs:
  post-bounty:
    if: contains(github.event.issue.labels.*.name, 'bounty')
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/actions/post-bounty@main
        with:
          solfoundry-api-url: 'https://api.solfoundry.io'
          solfoundry-api-token: ${{ secrets.SOLFOUNDRY_API_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Development

```bash
# Test locally
python3 -m pytest tests/

# Build Docker image
docker build -t solfoundry-post-bounty actions/post-bounty/
```
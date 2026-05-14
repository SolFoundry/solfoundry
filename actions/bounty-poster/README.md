# SolFoundry Bounty Poster — GitHub Action

Convert labeled GitHub issues into [SolFoundry](https://solfoundry.xyz) bounties automatically.

## How It Works

1. Someone adds a `bounty` label to an issue in your repo
2. This action fires and POSTs the issue data to the SolFoundry API
3. A bounty is created on SolFoundry with the issue details
4. A comment is posted on the issue with a link to the bounty

## Usage

Add this workflow to your repo at `.github/workflows/solfoundry-bounty.yml`:

```yaml
name: 'Post SolFoundry Bounty'
on:
  issues:
    types: [labeled]

jobs:
  post-bounty:
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty'
          reward-amount: '500000'
          tier: 't2'
          deadline-days: '30'
          skills: 'frontend,react'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-url` | No | `https://solfoundry.xyz` | SolFoundry API base URL |
| `solfoundry-api-key` | Yes | — | API key (store as GitHub secret) |
| `bounty-label` | No | `bounty` | Label that triggers bounty creation |
| `reward-amount` | No | `500000` | Default reward in $FNDRY tokens |
| `reward-token` | No | `FNDRY` | Reward token type |
| `tier` | No | `t2` | Default bounty tier (t1, t2, t3) |
| `deadline-days` | No | `30` | Deadline in days (0 = no deadline) |
| `skills` | No | ` ` | Comma-separated skill tags |
| `dry-run` | No | `false` | Log only, don't post to API |

## Per-Issue Overrides

Add an HTML comment to the issue body to override defaults:

```markdown
<!-- solfoundry: reward=1000000 tier=t1 skills=rust,backend deadline=14 -->
```

Supported overrides:
- `reward=N` — reward amount in $FNDRY
- `tier=t1|t2|t3` — bounty tier
- `skills=a,b,c` — skill tags
- `deadline=N` — deadline in days

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | Created bounty ID |
| `bounty-url` | URL to the bounty on SolFoundry |

## Setup

1. Get a SolFoundry API key from your dashboard
2. Add it as a repository secret: `SOLFOUNDRY_API_KEY`
3. Add the workflow file shown above
4. Label any issue with `bounty` — done!

## License

MIT

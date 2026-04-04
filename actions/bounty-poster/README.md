# SolFoundry Bounty Poster GitHub Action

Automatically convert labeled GitHub issues into SolFoundry bounties with customizable reward amounts and tiers.

## 🚀 Features

- **Label-based Detection**: Automatically detects issues with bounty labels
- **Customizable Rewards**: Configure reward amounts and tiers
- **Multi-Tier Support**: Supports T1, T2, T3 bounty tiers
- **Issue Linking**: Links back to original GitHub issues
- **Zero Configuration**: Works out of the box with sensible defaults

## 📋 Usage

### Basic Setup

Create `.github/workflows/solfoundry-bounties.yml` in your repository:

```yaml
name: SolFoundry Bounty Poster

on:
  issues:
    types: [labeled, opened]
  schedule:
    # Run daily at 9 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch:  # Manual trigger

jobs:
  post-bounties:
    runs-on: ubuntu-latest
    permissions:
      issues: read
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Post bounties to SolFoundry
        uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty'
          reward-amount: '100000'
          reward-tier: 'T2'
```

## 🔧 Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-key` | ✅ Yes | - | Your SolFoundry API key |
| `bounty-label` | ❌ No | `bounty` | Label that triggers bounty creation |
| `reward-amount` | ❌ No | `100000` | Reward amount in $FNDRY |
| `reward-tier` | ❌ No | `T1` | Bounty tier (T1, T2, T3) |
| `custom-webhook` | ❌ No | - | Custom webhook for notifications |

## 🎯 Bounty Tiers

| Tier | Reward Range | Requirements |
|------|-------------|--------------|
| T1 | 50K - 200K $FNDRY | Open to all contributors |
| T2 | 200K - 500K $FNDRY | Requires 1 merged T1 bounty |
| T3 | 500K - 1M+ $FNDRY | Requires 3 merged T2 bounties |

## 🔐 Setup

1. **Get SolFoundry API Key**:
   - Visit [SolFoundry Developer Portal](https://solfoundry.dev/developer)
   - Generate an API key

2. **Add GitHub Secret**:
   - Go to Settings → Secrets → Actions
   - Add `SOLFOUNDRY_API_KEY`

3. **Add Bounty Label**:
   - Create a label named `bounty` in your repo

## 📄 License

MIT License

# SolFoundry Bounty Poster GitHub Action

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-Ready-green)](https://github.com/marketplace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![SolFoundry](https://img.shields.io/badge/Powered%20by-SolFoundry-blue)](https://solfoundry.dev)

> Automatically convert labeled GitHub issues into SolFoundry bounties with customizable reward amounts and tiers.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Bounty Tiers](#bounty-tiers)
- [Setup Guide](#setup-guide)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

The **SolFoundry Bounty Poster** is a GitHub Action that automates the process of converting labeled GitHub issues into bounties on the [SolFoundry](https://solfoundry.dev) platform. This enables open-source projects to offer financial incentives for issue resolution without manual bounty creation.

### How It Works

1. A maintainer labels a GitHub issue with a designated tag (e.g., `bounty`)
2. This GitHub Action detects the labeled issue
3. The action automatically posts the issue as a bounty on SolFoundry
4. Contributors can discover and claim the bounty
5. Upon successful PR merge, the bounty is paid out

## Features

- ✅ **Label-based Detection**: Automatically detects issues with bounty labels
- ✅ **Customizable Rewards**: Configure reward amounts and tier levels
- ✅ **Multi-Tier Support**: Supports T1, T2, and T3 bounty tiers with different requirements
- ✅ **Issue Linking**: Automatically links back to original GitHub issues
- ✅ **Zero Configuration**: Works out of the box with sensible defaults
- ✅ **Webhook Support**: Optional custom webhook notifications
- ✅ **Secure**: Uses GitHub Secrets for API key management

## Quick Start

Add this workflow to your repository at `.github/workflows/solfoundry-bounties.yml`:

```yaml
name: SolFoundry Bounty Poster

on:
  issues:
    types: [labeled, opened]
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
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

## Usage

### Basic Usage

```yaml
- uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```

### Advanced Usage

```yaml
- uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    bounty-label: 'reward'
    reward-amount: '250000'
    reward-tier: 'T2'
    custom-webhook: 'https://hooks.example.com/bounty'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `solfoundry-api-key` | **Yes** | — | Your SolFoundry API key for authentication |
| `bounty-label` | No | `bounty` | GitHub label that triggers bounty creation |
| `reward-amount` | No | `100000` | Reward amount in $FNDRY tokens |
| `reward-tier` | No | `T1` | Bounty tier classification (T1/T2/T3) |
| `custom-webhook` | No | — | Optional webhook URL for notifications |

### Input Details

#### `solfoundry-api-key`

Your SolFoundry API key. This should be stored as a GitHub Secret.

**How to obtain:**
1. Visit [SolFoundry Developer Portal](https://solfoundry.dev/developer)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key for use in GitHub Secrets

#### `bounty-label`

The GitHub issue label that triggers automatic bounty creation.

**Examples:**
- `bounty` (default)
- `reward`
- `paid`
- `bounty-high`

#### `reward-amount`

The reward amount in $FNDRY tokens.

**Tier Guidelines:**
- T1: 50,000 - 200,000 $FNDRY
- T2: 200,000 - 500,000 $FNDRY
- T3: 500,000 - 1,000,000+ $FNDRY

#### `reward-tier`

The bounty tier determines contributor access requirements:

| Tier | Min Bounty | Access Requirement |
|------|------------|-------------------|
| T1 | 50K $FNDRY | Open to all contributors |
| T2 | 200K $FNDRY | Requires 1 merged T1 bounty |
| T3 | 500K $FNDRY | Requires 3 merged T2 bounties |

## Outputs

| Output | Description |
|--------|-------------|
| `bounty-id` | Unique identifier of the created bounty |
| `bounty-url` | Direct URL to view the bounty on SolFoundry |

### Using Outputs

```yaml
- uses: SolFoundry/solfoundry/actions/bounty-poster@main
  id: bounty
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}

- name: Post comment
  run: |
    echo "Bounty created: ${{ steps.bounty.outputs.bounty-url }}"
```

## Bounty Tiers

SolFoundry uses a tiered system to ensure quality contributions:

### T1 - Entry Level
- **Reward Range:** 50,000 - 200,000 $FNDRY
- **Access:** Open to all contributors
- **Best For:** Documentation, bug fixes, simple features

### T2 - Intermediate
- **Reward Range:** 200,000 - 500,000 $FNDRY
- **Access:** Requires 1 merged T1 bounty
- **Best For:** Feature implementations, integrations

### T3 - Advanced
- **Reward Range:** 500,000 - 1,000,000+ $FNDRY
- **Access:** Requires 3 merged T2 bounties
- **Best For:** Complex features, architectural changes

## Setup Guide

### Step 1: Get SolFoundry API Key

1. Visit [SolFoundry Developer Portal](https://solfoundry.dev/developer)
2. Sign in with your GitHub account
3. Navigate to "API Keys" section
4. Click "Generate New Key"
5. Copy the key (you won't see it again)

### Step 2: Add GitHub Secret

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SOLFOUNDRY_API_KEY`
5. Value: Paste your API key from Step 1
6. Click **Add secret**

### Step 3: Create Bounty Label

1. Go to your repository's **Issues** tab
2. Click **Labels** → **New label**
3. Name: `bounty` (or your preferred label)
4. Color: Choose a color (green recommended)
5. Description: "Issues eligible for SolFoundry bounty"
6. Click **Create label**

### Step 4: Add Workflow

1. Create `.github/workflows/solfoundry-bounties.yml`
2. Copy the [Quick Start](#quick-start) configuration
3. Commit and push to your repository

### Step 5: Test

1. Create a new issue in your repository
2. Add the `bounty` label
3. The workflow should trigger automatically
4. Check the Actions tab to see execution results

## Examples

### Example 1: Simple Bug Bounty

```yaml
name: Bug Bounty
on:
  issues:
    types: [labeled]

jobs:
  bounty:
    if: github.event.label.name == 'bug-bounty'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bug-bounty'
          reward-amount: '75000'
          reward-tier: 'T1'
```

### Example 2: Feature Bounty with Webhook

```yaml
name: Feature Bounty
on:
  issues:
    types: [labeled]

jobs:
  bounty:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'feature-request'
          reward-amount: '300000'
          reward-tier: 'T2'
          custom-webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

### Example 3: Scheduled Bounty Scan

```yaml
name: Daily Bounty Scan
on:
  schedule:
    - cron: '0 9 * * *'  # Every day at 9 AM UTC

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty'
          reward-amount: '100000'
          reward-tier: 'T1'
```

### Example 4: Multi-Tier Bounties

```yaml
name: Multi-Tier Bounties
on:
  issues:
    types: [labeled]

jobs:
  # T1 Bounties - Small fixes
  t1-bounty:
    if: github.event.label.name == 'bounty-t1'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty-t1'
          reward-amount: '100000'
          reward-tier: 'T1'
  
  # T2 Bounties - Features
  t2-bounty:
    if: github.event.label.name == 'bounty-t2'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: 'bounty-t2'
          reward-amount: '350000'
          reward-tier: 'T2'
```

## Troubleshooting

### Issue: "No issues found with label"

**Cause:** The label doesn't exist or no open issues have the label.

**Solution:**
1. Verify the label exists in your repository
2. Check that issues with the label are open (not closed)
3. Ensure the label name matches exactly (case-sensitive)

### Issue: "API key invalid"

**Cause:** The SolFoundry API key is incorrect or expired.

**Solution:**
1. Verify your `SOLFOUNDRY_API_KEY` secret is set correctly
2. Check that the API key hasn't expired
3. Generate a new key if necessary

### Issue: Action not triggering

**Cause:** Workflow configuration issue.

**Solution:**
1. Verify the workflow file is in `.github/workflows/`
2. Check the YAML syntax is valid
3. Ensure the workflow is enabled in the Actions tab
4. Verify trigger conditions match your use case

### Issue: "Permission denied"

**Cause:** The workflow lacks necessary permissions.

**Solution:**
Ensure your workflow has these permissions:
```yaml
permissions:
  issues: read
  contents: read
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork this repository
2. Clone your fork: `git clone https://github.com/your-username/solfoundry.git`
3. Navigate to the action: `cd actions/bounty-poster`
4. Make your changes
5. Test locally if possible
6. Submit a pull request

### Reporting Issues

If you encounter any issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/SolFoundry/solfoundry/issues)
3. Create a new issue with:
   - Description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Workflow configuration (with sensitive data redacted)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by the <a href="https://solfoundry.dev">SolFoundry</a> community
</p>

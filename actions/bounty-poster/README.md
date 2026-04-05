# @file README.md
# @brief Documentation for SolFoundry Bounty Poster GitHub Action
# @author BountyClaw
# @version 1.0.0
#
# @description
# Comprehensive documentation for the SolFoundry Bounty Poster GitHub Action,
# which automatically converts labeled GitHub issues into SolFoundry bounties.

# SolFoundry Bounty Poster GitHub Action

Automatically convert labeled GitHub issues into SolFoundry bounties with customizable reward amounts and tiers.

## Overview

This GitHub Action enables repository maintainers to automatically post bounties to the SolFoundry platform when issues are tagged with a specific label. It streamlines the bounty creation process by extracting issue details and posting them to SolFoundry with minimal configuration.

## Features

- **Label-based Detection**: Automatically detects issues with bounty labels
- **Customizable Rewards**: Configure reward amounts and tiers per workflow
- **Multi-Tier Support**: Supports T1, T2, T3 bounty tiers with different requirements
- **Issue Linking**: Automatically links back to original GitHub issues
- **Zero Configuration**: Works out of the box with sensible defaults
- **Webhook Notifications**: Optional custom webhook for bounty notifications
- **Batch Processing**: Handles multiple bounty issues in a single run

## Requirements

- GitHub repository with issue tracking enabled
- SolFoundry account with API access
- GitHub Actions enabled on the repository

## Installation

### Step 1: Get SolFoundry API Key

1. Visit [SolFoundry Developer Portal](https://solfoundry.dev/developer)
2. Sign in or create an account
3. Navigate to API Keys section
4. Generate a new API key with bounty posting permissions
5. Copy the key for use in GitHub Secrets

### Step 2: Add GitHub Secret

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SOLFOUNDRY_API_KEY`
5. Value: Your SolFoundry API key from Step 1
6. Click **Add secret**

### Step 3: Create Bounty Label

1. Go to your repository → **Issues** → **Labels**
2. Click **New label**
3. Name: `bounty` (or your preferred label name)
4. Color: Choose a distinctive color (e.g., green `#0E8A16`)
5. Description: "Issues eligible for SolFoundry bounties"
6. Click **Create label**

### Step 4: Create Workflow

Create `.github/workflows/solfoundry-bounties.yml`:

```yaml
# @file solfoundry-bounties.yml
# @brief Workflow for automatic bounty posting
# @description Triggers bounty creation when issues are labeled or on schedule

name: SolFoundry Bounty Poster

on:
  # Trigger when issues are labeled
  issues:
    types: [labeled, opened, edited]
  
  # Run daily at 9 AM UTC to catch any missed issues
  schedule:
    - cron: '0 9 * * *'
  
  # Allow manual trigger for testing
  workflow_dispatch:
    inputs:
      bounty_label:
        description: 'Label to scan for bounties'
        required: false
        default: 'bounty'
      reward_amount:
        description: 'Reward amount in $FNDRY'
        required: false
        default: '100000'

jobs:
  post-bounties:
    # Use Ubuntu latest runner
    runs-on: ubuntu-latest
    
    # Required permissions for issue reading
    permissions:
      issues: read
      contents: read
    
    steps:
      # Checkout repository code
      - name: Checkout repository
        uses: actions/checkout@v4
      
      # Run the bounty poster action
      - name: Post bounties to SolFoundry
        uses: SolFoundry/solfoundry/actions/bounty-poster@main
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          bounty-label: ${{ github.event.inputs.bounty_label || 'bounty' }}
          reward-amount: ${{ github.event.inputs.reward_amount || '100000' }}
          reward-tier: 'T2'
```

## Configuration

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `solfoundry-api-key` | string | ✅ Yes | - | Your SolFoundry API key for authentication |
| `bounty-label` | string | ❌ No | `bounty` | Label that triggers bounty creation |
| `reward-amount` | string | ❌ No | `100000` | Reward amount in $FNDRY tokens |
| `reward-tier` | string | ❌ No | `T1` | Bounty tier (T1, T2, T3) |
| `custom-webhook` | string | ❌ No | - | Custom webhook URL for notifications |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `bounty-id` | string | Unique identifier of the created bounty |
| `bounty-url` | string | Direct URL to view the bounty on SolFoundry |

### Bounty Tiers

| Tier | Reward Range | Requirements | Use Case |
|------|-------------|--------------|----------|
| **T1** | 50K - 200K $FNDRY | Open to all contributors | Simple bugs, documentation fixes |
| **T2** | 200K - 500K $FNDRY | Requires 1 merged T1 bounty | Feature implementations |
| **T3** | 500K - 1M+ $FNDRY | Requires 3 merged T2 bounties | Complex features, architecture work |

## Usage Examples

### Basic Usage

```yaml
- uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```

### With Custom Label

```yaml
- uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    bounty-label: 'reward'
    reward-amount: '50000'
```

### Tier-Based Workflows

```yaml
# High-priority bounties
- name: Post high-priority bounties
  uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    bounty-label: 'bounty-high'
    reward-amount: '500000'
    reward-tier: 'T2'

# Standard bounties
- name: Post standard bounties
  uses: SolFoundry/solfoundry/actions/bounty-poster@main
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    bounty-label: 'bounty'
    reward-amount: '100000'
    reward-tier: 'T1'
```

## Creating a Bounty Issue

To create a bounty-eligible issue:

1. Create a new issue with a clear title and description
2. Add acceptance criteria as a checklist
3. Apply the bounty label (e.g., `bounty`)
4. The action will automatically detect and post it

### Example Issue Template

```markdown
## Description
Implement user authentication with JWT tokens.

## Acceptance Criteria
- [ ] Login endpoint with email/password
- [ ] JWT token generation
- [ ] Token refresh mechanism
- [ ] Password reset flow

## Reward
50000 $FNDRY
```

## Troubleshooting

### "No issues found with label"

- Ensure the label exists in your repository
- Check that issues with the label are open (not closed)
- Verify the label name matches exactly (case-sensitive)

### "API key invalid"

- Verify your `SOLFOUNDRY_API_KEY` secret is set correctly
- Check that the API key hasn't expired
- Ensure the key has bounty posting permissions

### Action not triggering

- Verify the workflow file is in `.github/workflows/`
- Check the YAML syntax is valid
- Ensure the workflow is enabled in the Actions tab

## Security Considerations

- Store your SolFoundry API key as a GitHub Secret
- Never commit API keys to your repository
- Use repository-level secrets rather than organization-level for fine-grained control
- Rotate API keys periodically

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

## Support

- [SolFoundry Documentation](https://docs.solfoundry.dev)
- [GitHub Issues](https://github.com/SolFoundry/solfoundry/issues)
- [Discord Community](https://discord.gg/solfoundry)

---

*Built with ❤️ by the SolFoundry community*

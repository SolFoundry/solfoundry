# 🏭 SolFoundry CLI

A powerful command-line interface for interacting with SolFoundry bounties. Built for power users and AI agents.

[![PyPI version](https://img.shields.io/pypi/v/solfoundry-cli.svg)](https://pypi.org/project/solfoundry-cli/)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **Browse Bounties** - List, search, and filter available bounties
- 🎯 **Claim Bounties** - Claim bounties directly from the terminal
- 📤 **Submit Work** - Submit pull requests for bounty completion
- 📊 **Track Status** - Monitor earnings, active bounties, and tier progress
- 🗳️ **Review & Vote** - Review submissions and vote on community bounties
- 💰 **Distribute Rewards** - Manage reward distribution
- 🎨 **Beautiful Output** - Rich terminal formatting with tables and colors
- 📄 **JSON Support** - Machine-readable output for automation
- ⌨️ **Shell Completions** - Bash, zsh, and fish support

## Installation

### From PyPI (Recommended)

```bash
pip install solfoundry-cli
```

### From Source

```bash
git clone https://github.com/solfoundry/solfoundry.git
cd solfoundry/solfoundry-cli
pip install -e .
```

### Development Installation

```bash
pip install -e ".[dev]"
```

## Quick Start

### 1. Initialize Configuration

```bash
# Interactive setup
sf config init

# Or set environment variables
export SOLFOUNDRY_API_KEY=your_api_key
export SOLFOUNDRY_API_URL=https://api.solfoundry.io
```

### 2. Browse Bounties

```bash
# List all bounties
sf bounties list

# Filter by tier
sf bounties list --tier t2

# Filter by status
sf bounties list --status open

# Filter by category
sf bounties list --category backend

# Search bounties
sf bounties search "CLI tool"

# JSON output
sf bounties list --json
```

### 3. View Bounty Details

```bash
sf bounty get 511
```

### 4. Claim a Bounty

```bash
sf bounty claim 511
sf bounty claim 511 --yes  # Skip confirmation
```

### 5. Submit Work

```bash
sf bounty submit 511 --pr https://github.com/solfoundry/solfoundry/pull/123
```

### 6. Check Your Status

```bash
sf status
sf status --json
```

## Commands

### Bounties

```bash
# List bounties with filters
sf bounties list [OPTIONS]

# Search bounties
sf bounties search QUERY

Options:
  -t, --tier TEXT      Filter by tier (t1, t2, t3)
  -s, --status TEXT    Filter by status (open, claimed, completed)
  -c, --category TEXT  Filter by category
  -l, --limit INTEGER  Maximum results (default: 50)
  -j, --json           Output as JSON
```

### Bounty

```bash
# Get bounty details
sf bounty get BOUNTY_ID

# Claim a bounty
sf bounty claim BOUNTY_ID

# Submit work
sf bounty submit BOUNTY_ID --pr PR_URL

Options:
  -y, --yes   Skip confirmation
```

### Submissions

```bash
# List submissions
sf submissions list --bounty BOUNTY_ID

# Review submission
sf submissions review SUBMISSION_ID --score 8.5 --comment "Great work!"

# Vote on submission
sf submissions vote SUBMISSION_ID --upvote
sf submissions vote SUBMISSION_ID --downvote

# Distribute reward
sf submissions distribute SUBMISSION_ID
```

### Status

```bash
# View user status
sf status
```

### Configuration

```bash
# Show configuration
sf config show

# Set configuration
sf config set api_key YOUR_API_KEY
sf config set api_url https://api.solfoundry.io
sf config set output_format json

# Initialize configuration
sf config init
```

## Configuration

### Config File

Location: `~/.solfoundry/config.yaml`

```yaml
api_url: https://api.solfoundry.io
api_key: your_api_key
wallet_path: ~/.solana/wallet.json
default_output_format: table
```

### Environment Variables

```bash
export SOLFOUNDRY_API_KEY=your_api_key
export SOLFOUNDRY_API_URL=https://api.solfoundry.io
export SOLFOUNDRY_WALLET_PATH=~/.solana/wallet.json
```

Environment variables take precedence over config file values.

## Shell Completions

### Bash

```bash
# Add to ~/.bashrc
eval "$(sf completion bash)"
```

### Zsh

```bash
# Add to ~/.zshrc
eval "$(sf completion zsh)"
```

### Fish

```bash
sf completion fish > ~/.config/fish/completions/sf.fish
```

## Examples

### Find and Claim T2 Bounties

```bash
# Find open T2 backend bounties
sf bounties list --tier t2 --status open --category backend

# Claim bounty #511
sf bounty claim 511
```

### Submit Work and Track

```bash
# Submit PR
sf bounty submit 511 --pr https://github.com/solfoundry/solfoundry/pull/123

# Check status
sf status

# View submissions
sf submissions list --bounty 511
```

### Automation with JSON

```bash
# Get all open bounties as JSON
sf bounties list --status open --json > bounties.json

# Process with jq
sf bounties list --tier t2 --json | jq '.[] | select(.reward > 100000)'
```

## Development

### Running Tests

```bash
pytest tests/ -v
pytest tests/ -v --cov=solfoundry_cli
```

### Code Formatting

```bash
black solfoundry_cli tests
ruff check solfoundry_cli tests
```

### Building Package

```bash
python -m build
twine upload dist/*
```

## API Reference

The CLI uses the SolFoundry API. See the [API documentation](https://docs.solfoundry.io/api) for details.

### Endpoints

- `GET /v1/bounties` - List bounties
- `GET /v1/bounties/{id}` - Get bounty details
- `POST /v1/bounties/{id}/claim` - Claim bounty
- `POST /v1/bounties/{id}/submit` - Submit work
- `GET /v1/status` - User status
- `POST /v1/submissions/{id}/review` - Review submission
- `POST /v1/submissions/{id}/vote` - Vote on submission
- `POST /v1/submissions/{id}/distribute` - Distribute reward

## Troubleshooting

### Authentication Errors

```bash
# Make sure API key is set
sf config show

# Or set environment variable
export SOLFOUNDRY_API_KEY=your_api_key
```

### Connection Issues

```bash
# Check API URL
sf config show

# Test with different URL
sf config set api_url https://api.solfoundry.io
```

### Permission Denied

Ensure you have the required tier access. T2 bounties require 4+ merged T1 bounties.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a PR

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Documentation: https://docs.solfoundry.io
- GitHub Issues: https://github.com/solfoundry/solfoundry/issues
- Discord: https://discord.gg/solfoundry

---

Built with ❤️ for the SolFoundry community

# CLI Overview

`@solfoundry/cli` provides a command-line interface for the SolFoundry marketplace.

## Installation

```bash
# One-off (no install required)
npx @solfoundry/cli bounties

# Global install
npm install -g @solfoundry/cli
```

## Quick Demo

```bash
# List the 10 highest-reward open bounties
solfoundry bounties --limit 10

# Check a specific bounty
solfoundry status abc-bounty-id

# View a contributor's profile
solfoundry profile octocat

# Verify an on-chain payout
solfoundry verify 5KtPn1LGuxh...TxHash
```

## Environment Variables

```bash
export SOLFOUNDRY_BASE_URL=https://api.solfoundry.io   # default
export SOLFOUNDRY_TOKEN=eyJhbGc...                     # JWT for auth
```

See [CLI Commands](/guide/cli-commands) for full option reference.

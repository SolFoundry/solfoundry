# Local Development Guide

## Overview

This guide explains how to set up and run a local Solana validator for
SolFoundry development. Running tests against a local validator is faster,
free, and doesn't require devnet SOL.

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | [docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools) |
| Anchor CLI | 0.30+ | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install latest && avm use latest` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Yarn / npm | any | `npm install -g yarn` |

Verify your installation:

```bash
solana --version          # solana-cli 1.18.x
anchor --version          # anchor-cli 0.30.x
node --version            # v18.x or higher
```

---

## Quick Start

### 1. Clone and install dependencies

```bash
git clone https://github.com/SolFoundry/solfoundry.git
cd solfoundry

# Install frontend/backend dependencies
npm install

# Install Anchor program dependencies
cd contracts/bounty-registry
yarn install
cd ../..
```

### 2. Build the Anchor program

```bash
cd contracts/bounty-registry
anchor build
cd ../..
```

This compiles the program to:
```
contracts/bounty-registry/target/deploy/bounty_registry.so
```

### 3. Start the local validator

```bash
./scripts/local-validator.sh
```

The script will:
- Check Solana CLI is installed
- Configure your CLI for `localnet` (http://127.0.0.1:8899)
- Start `solana-test-validator` with the bounty-registry program pre-deployed
- Airdrop 100 SOL to your local wallet
- Block until you press **Ctrl+C**

Options:
```bash
./scripts/local-validator.sh --reset    # Wipe ledger and start fresh
./scripts/local-validator.sh --no-wait  # Start in background, return immediately
```

### 4. Set up test accounts (new terminal)

```bash
./scripts/setup-test-accounts.sh
```

This will fund the three fixture wallets in `contracts/bounty-registry/tests/fixtures/`
with test SOL so Anchor tests can sign transactions.

### 5. Run the tests

```bash
cd contracts/bounty-registry

# Anchor test starts its own validator (default)
anchor test

# Connect to an already-running validator (faster, recommended)
anchor test --skip-local-validator
```

---

## Directory Layout

```
solfoundry/
├── scripts/
│   ├── local-validator.sh          # Start local Solana validator
│   └── setup-test-accounts.sh      # Fund test fixture keypairs
├── contracts/
│   └── bounty-registry/
│       ├── Anchor.toml             # Cluster + validator config
│       ├── programs/               # Rust source code
│       ├── tests/
│       │   ├── bounty-registry.ts  # TypeScript integration tests
│       │   └── fixtures/           # Pre-generated test keypairs
│       │       ├── README.md
│       │       ├── authority.json
│       │       ├── contributor1.json
│       │       └── contributor2.json
│       └── target/
│           └── deploy/
│               └── bounty_registry.so  # Compiled program (after `anchor build`)
└── docs/
    └── local-development.md        # This file
```

---

## Environment Variables

The local validator is pre-configured via `Anchor.toml`. You can override
individual settings with environment variables if needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANCHOR_PROVIDER_URL` | `http://127.0.0.1:8899` | RPC endpoint |
| `ANCHOR_WALLET` | `~/.config/solana/id.json` | Signer keypair |

---

## Anchor.toml: `[test.validator]` Section

The `contracts/bounty-registry/Anchor.toml` includes a `[test.validator]`
block that controls how `anchor test` starts its embedded validator:

```toml
[test]
startup_wait = 5000          # ms to wait for validator to boot

[test.validator]
url = "http://127.0.0.1:8899"
ledger = ".ledger"           # ledger data directory
bind_address = "0.0.0.0"

[[test.validator.account]]   # pre-load the authority fixture
address = "..."
filename = "tests/fixtures/authority.json"

[[test.validator.clone]]     # clone SPL Token from devnet
address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

[test.validator.slots_per_epoch]
slots_per_epoch = 32         # shorter epochs for epoch-boundary tests
```

---

## Using Fixture Keypairs in Tests

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";

// Load fixture keypairs
const authority    = Keypair.fromSecretKey(Uint8Array.from(require("./fixtures/authority.json")));
const contributor1 = Keypair.fromSecretKey(Uint8Array.from(require("./fixtures/contributor1.json")));
const contributor2 = Keypair.fromSecretKey(Uint8Array.from(require("./fixtures/contributor2.json")));

// These addresses are deterministic — useful for PDA derivation in tests
console.log("Authority:", authority.publicKey.toBase58());
console.log("Contributor1:", contributor1.publicKey.toBase58());
console.log("Contributor2:", contributor2.publicKey.toBase58());
```

> **⚠️ Warning:** These keypairs are test-only. Never use them on mainnet
> or fund them with real SOL.

---

## Troubleshooting

### Validator won't start

```bash
# Check if port 8899 is already in use
lsof -i :8899

# Kill any stale validator
pkill -f solana-test-validator

# Start fresh
./scripts/local-validator.sh --reset
```

### `anchor test` fails with "connection refused"

The validator isn't running. Start it first:

```bash
./scripts/local-validator.sh &
sleep 5
anchor test --skip-local-validator
```

### Program not found / "Account not found"

The program binary wasn't deployed. Rebuild:

```bash
cd contracts/bounty-registry
anchor build
./scripts/local-validator.sh --reset
```

### Insufficient funds error in tests

Run the account setup script:

```bash
./scripts/setup-test-accounts.sh
```

### macOS: `xcrun: error`

Install Xcode command-line tools:

```bash
xcode-select --install
```

### Linux: `libssl` errors with Solana CLI

```bash
sudo apt-get install -y libssl-dev pkg-config build-essential
```

---

## Resetting State

To start from a completely clean chain:

```bash
# Stop the validator (Ctrl+C if running in foreground), then:
./scripts/local-validator.sh --reset

# In a new terminal:
./scripts/setup-test-accounts.sh
```

---

## CI / GitHub Actions

For CI environments, `anchor test` handles validator lifecycle automatically.
No manual setup is needed — the `[test.validator]` section in `Anchor.toml`
is all CI needs.

Example CI step:

```yaml
- name: Run Anchor tests
  working-directory: contracts/bounty-registry
  run: anchor test
  env:
    ANCHOR_WALLET: ${{ secrets.SOLANA_TEST_WALLET }}
```

---

## Additional Resources

- [Solana CLI docs](https://docs.solana.com/cli)
- [Anchor docs](https://www.anchor-lang.com/docs)
- [SolFoundry CONTRIBUTING.md](../CONTRIBUTING.md)
- [solana-test-validator reference](https://docs.solana.com/developing/test-validator)

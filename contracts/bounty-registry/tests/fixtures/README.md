# Test Fixtures

This directory contains pre-generated keypairs for deterministic local testing.

## ⚠️ IMPORTANT — TEST ONLY

These keypairs are **not cryptographically secure** and must **never** be used
on mainnet or with real funds. They exist solely to give tests a reproducible
set of addresses so PDA derivations and authority checks are deterministic.

## Keypairs

| File | Role | Notes |
|------|------|-------|
| `authority.json` | Program admin / upgrade authority | Used as the `admin` signer in tests |
| `contributor1.json` | First test contributor wallet | Used for bounty submission tests |
| `contributor2.json` | Second test contributor wallet | Used for multi-contributor tests |

## Usage in Tests

```typescript
import { Keypair } from "@solana/web3.js";
import authorityJson from "./fixtures/authority.json";
import contributor1Json from "./fixtures/contributor1.json";
import contributor2Json from "./fixtures/contributor2.json";

const authority    = Keypair.fromSecretKey(Uint8Array.from(authorityJson));
const contributor1 = Keypair.fromSecretKey(Uint8Array.from(contributor1Json));
const contributor2 = Keypair.fromSecretKey(Uint8Array.from(contributor2Json));
```

## Funding

Run the setup script to airdrop SOL to all fixtures on the local validator:

```bash
./scripts/setup-test-accounts.sh
```

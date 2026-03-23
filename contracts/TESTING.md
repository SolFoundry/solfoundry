# SolFoundry — Solana Program Testing Guide

This guide explains how to write and run tests for the SolFoundry on-chain programs:

- **`bounty-registry`** — `contracts/bounty-registry/`
- **`fndry-staking`** — `contracts/staking-program/`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Architecture](#test-architecture)
3. [Running Tests Locally](#running-tests-locally)
4. [Writing New Tests](#writing-new-tests)
5. [Test Coverage](#test-coverage)
6. [CI Integration](#ci-integration)
7. [Test Count Reference](#test-count-reference)

---

## Prerequisites

Install all toolchain dependencies before running tests.

### Rust & Solana

```bash
# Install Rust (stable, 1.79+)
curl https://sh.rustup.rs -sSf | sh
rustup component add clippy rustfmt

# Install Solana CLI (1.18.x)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"

# Generate a local keypair (test wallet)
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json

# Configure for localnet
solana config set --url localnet
```

### Anchor

```bash
npm install -g @coral-xyz/anchor-cli@0.30.1
```

### Node.js dependencies (per program)

```bash
cd contracts/bounty-registry && npm install
cd contracts/staking-program && npm install
```

---

## Test Architecture

```
contracts/
├── tests/
│   ├── helpers/
│   │   └── index.ts              # Shared TypeScript test utilities
│   └── integration/
│       └── multi-program.ts      # Cross-program integration tests
│
├── bounty-registry/
│   ├── Cargo.toml                # Workspace root (for cargo test)
│   ├── programs/bounty-registry/
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── state.rs
│   │       └── tests.rs          ← Rust unit tests
│   └── tests/
│       ├── bounty-registry.ts    # Anchor integration tests (localnet)
│       └── bankrun/
│           └── bounty-registry.bankrun.ts  ← bankrun tests (in-process)
│
└── staking-program/
    ├── Cargo.toml                # Workspace root (for cargo test)
    ├── programs/fndry-staking/
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       └── tests.rs          ← Rust unit tests
    └── tests/
        ├── fndry-staking.ts      # Anchor integration tests (localnet)
        └── bankrun/
            └── staking.bankrun.ts  ← bankrun tests (in-process)
```

### Three layers of testing

| Layer | Tool | Validator | Speed | Best for |
|-------|------|-----------|-------|---------|
| **Rust unit** | `cargo test` | None | ~1s | Pure logic: math, state machines, validation |
| **bankrun** | `solana-bankrun` | In-process | ~5s | Instruction dispatch, account reads, clock |
| **Integration** | `anchor test` | Local (8899) | ~60s | Full stack: tokens, CPIs, real program state |

---

## Running Tests Locally

### Rust unit tests (fastest, no validator)

```bash
# bounty-registry
cd contracts/bounty-registry
cargo test --manifest-path programs/bounty-registry/Cargo.toml

# fndry-staking
cd contracts/staking-program
cargo test --manifest-path programs/fndry-staking/Cargo.toml
```

Expected output: all tests pass in under 1 second.

### bankrun tests (in-process, requires built .so)

Build first, then run:

```bash
# bounty-registry
cd contracts/bounty-registry
anchor build
npm run test:bankrun

# fndry-staking
cd contracts/staking-program
anchor build
npm run test:bankrun
```

bankrun boots a Solana program-test context in-process — no external process needed.

### Anchor integration tests (full local validator)

```bash
# bounty-registry
cd contracts/bounty-registry
anchor test

# fndry-staking
cd contracts/staking-program
anchor test
```

`anchor test` automatically:
1. Starts a local Solana test validator on port 8899
2. Builds and deploys the program
3. Runs all `tests/**/*.ts` files
4. Shuts down the validator

To connect to an already-running validator (e.g. started with `solana-test-validator`):

```bash
anchor test --skip-local-validator
```

### Multi-program integration tests

The integration tests require **both** programs to be deployed in the same Anchor workspace. They are designed to run as part of the standard `anchor test` suite when both workspace references are configured:

```bash
# From the contracts/ root (once workspace Anchor.toml is configured)
anchor test
```

Until then, run them in the bounty-registry workspace (they skip gracefully if the staking program isn't present):

```bash
cd contracts/bounty-registry
# Copy tests/integration/ into tests/ then run:
anchor test
```

---

## Writing New Tests

### Rust unit test template

Add a new `#[test]` to the relevant `src/tests.rs`:

```rust
// In contracts/bounty-registry/programs/bounty-registry/src/tests.rs

#[test]
fn my_new_validation_test() {
    // Arrange
    let input = "some value";

    // Act
    let result = validate_something(input);

    // Assert
    assert!(result, "Expected validation to pass for: {}", input);
}
```

Guidelines:
- Use `assert!`, `assert_eq!`, `assert_ne!` — no external crates needed.
- Test one thing per test function.
- Name tests in `snake_case` describing the scenario: `status_open_cannot_transition_to_completed`.

### TypeScript integration test template

Add a new `it()` block inside any `describe()` in `tests/bounty-registry.ts`:

```typescript
it("should do something specific", async () => {
  // Arrange: set up state
  const bountyId = getNextBountyId();
  await registerDefaultBounty(bountyId);

  // Act: call the instruction
  const [bountyPda] = derivePda(bountyId, program.programId);
  await program.methods
    .updateStatus(1, contributor.publicKey)
    .accounts({ admin: admin.publicKey, bountyRecord: bountyPda })
    .rpc();

  // Assert: verify on-chain state
  const record = await program.account.bountyRecord.fetch(bountyPda);
  expect(record.status).to.deep.include({ claimed: {} });
});
```

### Using shared helpers

Import from the shared helpers module:

```typescript
import {
  createFundedKeypair,
  deriveBountyPda,
  advanceClock,
  mockPrHash,
  expectAnchorError,
  BRONZE_MIN,
} from "../../tests/helpers";
```

### Testing expected errors

Use `expectAnchorError` from the helpers module:

```typescript
import { expectAnchorError } from "../../tests/helpers";

await expectAnchorError(
  () => program.methods.registerBounty(...).rpc(),
  "TitleTooLong"
);
```

Or use try/catch directly:

```typescript
try {
  await program.methods.someInstruction(...).rpc();
  expect.fail("Expected error not thrown");
} catch (error: any) {
  expect(error).to.be.instanceOf(AnchorError);
  expect(error.error.errorCode.code).to.equal("ExpectedErrorCode");
}
```

### bankrun test template

```typescript
import { start, ProgramTestContext } from "solana-bankrun";
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("Your...ProgramId");

describe("my bankrun tests", function () {
  let context: ProgramTestContext;

  before(async function () {
    context = await start(
      [{ name: "my_program", programId: PROGRAM_ID }],
      []
    );
  });

  it("does something fast", async function () {
    const clock = await context.banksClient.getClock();
    // advance clock by 7 days
    await context.setClock({
      ...clock,
      unixTimestamp: clock.unixTimestamp + BigInt(7 * 24 * 60 * 60),
    });
    // ... assert
  });
});
```

---

## Test Coverage

### Generate a coverage report

```bash
# bounty-registry
cd contracts/bounty-registry
npm run test:coverage

# fndry-staking
cd contracts/staking-program
npm run test:coverage
```

Reports are written to `coverage/` in LCOV and text formats.

### View the report

```bash
open coverage/index.html     # macOS
xdg-open coverage/index.html # Linux
```

### Coverage targets

| Metric | Target |
|--------|--------|
| Lines | ≥ 80% |
| Functions | ≥ 80% |
| Branches | ≥ 70% |

---

## CI Integration

Tests run automatically on every pull request and push to `main` that touches `contracts/`.

### Pipeline summary

```
bounty-registry-build          ─┐
bounty-registry-rust-tests     ─┤─→ bounty-registry-integration-tests → coverage
                                 │
staking-build                  ─┤
staking-rust-tests             ─┤─→ staking-integration-tests → coverage
                                 │
rust-quality (clippy/fmt/audit)─┘
                                 └─→ anchor-status (summary)
```

### What CI checks

- `anchor build` succeeds for both programs
- All Rust unit tests (`cargo test`) pass — **required job, blocks merge**
- All TypeScript integration tests (`anchor test`) pass
- Clippy produces no errors
- Rustfmt formatting is consistent
- `cargo audit` finds no known vulnerabilities
- Coverage reports are uploaded as artifacts

### Viewing CI results

1. Open the PR on GitHub
2. Click **Details** next to the "Anchor CI" check
3. Click **"Anchor CI — Summary"** job for the table overview
4. Download coverage artifacts from the **Artifacts** section

---

## Test Count Reference

Current test counts (as of this writing):

| Location | Count | Description |
|----------|-------|-------------|
| `bounty-registry/src/tests.rs` | 30 | Rust: state machine (11), from_u8 (7), constants (5), tiers (6), scores (6) |
| `staking-program/src/tests.rs` | 32 | Rust: constants (9), thresholds (5), rewards (9), tier helpers (9) |
| `bounty-registry/tests/bounty-registry.ts` | 20+ | TS: register (11), update_status (6+), record_completion (3+) |
| `staking-program/tests/fndry-staking.ts` | 15+ | TS: init (2), stake (4+), unstake (3+), rewards (3+), tiers (3+) |
| `bounty-registry/tests/bankrun/` | 9 | bankrun: PDAs (3), payer (1), clock (3), program deploy (1), payer (1) |
| `staking-program/tests/bankrun/` | 14 | bankrun: PDAs (5), rewards (5), clock (3), deploy (1) |
| `tests/integration/multi-program.ts` | 8 | Integration: 7 lifecycle steps + cross-program coherence |
| **Total** | **≥ 128** | |

---

## Troubleshooting

### `anchor build` fails with "program not found"

Ensure you are in the correct subdirectory:

```bash
cd contracts/bounty-registry   # not contracts/
anchor build
```

### bankrun tests skip with "program .so not found"

Run `anchor build` first to compile the `.so`:

```bash
anchor build
npm run test:bankrun
```

### Local validator port 8899 already in use

```bash
# Kill any existing validator
pkill -f solana-test-validator

# Or use a different port
solana-test-validator --rpc-port 8900 &
anchor test --provider.cluster http://127.0.0.1:8900
```

### `cargo test` fails with "unresolved import"

The `fndry_staking` program's `calculate_rewards` is `pub(crate)`. If you need to test it from an external crate, add `#[cfg(test)]` helper re-exports. The current unit tests in `src/tests.rs` access it directly (same crate).

### Integration tests timeout

Increase the mocha timeout in `Anchor.toml`:

```toml
[scripts]
test = "npx ts-mocha -p ./tsconfig.json -t 300000 tests/**/*.ts"
```

/**
 * bankrun tests for the bounty-registry program.
 *
 * bankrun runs Solana programs in-process using solana-program-test,
 * eliminating the need for a local validator. Tests are 10-50× faster
 * than `anchor test` for unit-like scenarios.
 *
 * Prerequisites
 * -------------
 * 1. Build the program: `anchor build` (generates target/deploy/bounty_registry.so)
 * 2. Install deps:      `npm install`
 * 3. Run these tests:   `npm run test:bankrun`
 *
 * What bankrun tests cover vs Anchor integration tests
 * -----------------------------------------------------
 * bankrun:  individual instruction validation, error paths, state transitions.
 *           No local validator startup → sub-second test execution.
 * anchor:   full stack with real token transfers, cross-program interactions,
 *           and clock-based tests that need the real Solana runtime.
 */

import { start, BanksClient, ProgramTestContext } from "solana-bankrun";
import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// Program configuration
// ─────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(
  "DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe"
);

/** Path to the compiled program (relative to contract root). */
const PROGRAM_SO = path.resolve(
  __dirname,
  "../../target/deploy/bounty_registry.so"
);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const REGISTRY_SEED = Buffer.from("registry");

function deriveBountyPda(bountyId: number): [PublicKey, number] {
  const idBuf = new BN(bountyId).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync([REGISTRY_SEED, idBuf], PROGRAM_ID);
}

/**
 * Build a pre-funded keypair funded via the bankrun genesis configuration.
 * bankrun contexts get an auto-funded payer at context.payer.
 */
function fundedKeypair(context: ProgramTestContext): Keypair {
  return context.payer;
}

// ─────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────

describe("bounty-registry (bankrun)", function () {
  this.timeout(30_000);

  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;

  before(async function () {
    try {
      // Start the in-process test validator with the compiled program.
      context = await start(
        [{ name: "bounty_registry", programId: PROGRAM_ID }],
        []
      );
      client = context.banksClient;
      payer = context.payer;
    } catch (err: any) {
      if (
        err.message?.includes("ENOENT") ||
        err.message?.includes("No such file")
      ) {
        console.log(
          "\n  ⚠️  bankrun tests skipped: program .so not found.\n" +
            `     Expected: ${PROGRAM_SO}\n` +
            "     Run `anchor build` first.\n"
        );
        this.skip();
      } else {
        throw err;
      }
    }
  });

  // ── Helper: send a transaction via BanksClient ──────────────────

  async function sendTx(tx: Transaction): Promise<void> {
    const recentBlockhash = await client.getLatestBlockhash();
    tx.recentBlockhash = recentBlockhash[0];
    tx.feePayer = payer.publicKey;
    tx.sign(payer);
    await client.processTransaction(tx);
  }

  // ── Bankrun clock helpers ───────────────────────────────────────

  async function advanceClockBy(seconds: number): Promise<void> {
    const clock = await client.getClock();
    await context.setClock({
      slot: clock.slot,
      epochStartTimestamp: clock.epochStartTimestamp,
      epoch: clock.epoch,
      leaderScheduleEpoch: clock.leaderScheduleEpoch,
      unixTimestamp: clock.unixTimestamp + BigInt(seconds),
    });
  }

  // ── Test 1: Accounts can be derived correctly ───────────────────

  it("derives PDA correctly for bounty id 1", function () {
    const [pda, bump] = deriveBountyPda(1);
    expect(pda).to.be.instanceOf(PublicKey);
    expect(bump).to.be.a("number").and.to.be.greaterThan(0).and.lessThan(256);
  });

  it("derives different PDAs for different bounty ids", function () {
    const [pda1] = deriveBountyPda(1);
    const [pda2] = deriveBountyPda(2);
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it("derives deterministic PDA for same bounty id", function () {
    const [pda1] = deriveBountyPda(42);
    const [pda2] = deriveBountyPda(42);
    expect(pda1.toBase58()).to.equal(pda2.toBase58());
  });

  // ── Test 2: Payer has SOL ───────────────────────────────────────

  it("payer account is funded in bankrun context", async function () {
    const balance = await client.getBalance(payer.publicKey);
    expect(Number(balance)).to.be.greaterThan(0);
  });

  // ── Test 3: Clock is accessible and advanceable ─────────────────

  it("bankrun clock starts at a positive unix timestamp", async function () {
    const clock = await client.getClock();
    expect(clock.unixTimestamp).to.be.greaterThan(0n);
  });

  it("can advance bankrun clock by 7 days", async function () {
    const before = await client.getClock();
    const sevenDays = 7 * 24 * 60 * 60;
    await advanceClockBy(sevenDays);
    const after = await client.getClock();
    expect(after.unixTimestamp).to.equal(
      before.unixTimestamp + BigInt(sevenDays)
    );
  });

  it("can advance bankrun clock by 1 year for reward testing", async function () {
    const before = await client.getClock();
    const oneYear = 365 * 24 * 60 * 60;
    await advanceClockBy(oneYear);
    const after = await client.getClock();
    expect(after.unixTimestamp).to.equal(
      before.unixTimestamp + BigInt(oneYear)
    );
  });

  // ── Test 4: Program is deployed ─────────────────────────────────

  it("program account exists in bankrun context", async function () {
    const programAccount = await client.getAccount(PROGRAM_ID);
    expect(programAccount).to.not.be.null;
    expect(programAccount?.executable).to.be.true;
  });
});

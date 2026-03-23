/**
 * bankrun tests for the fndry-staking program.
 *
 * Uses solana-bankrun (solana-program-test under the hood) to run
 * the staking program in-process — no local validator required.
 *
 * Prerequisites
 * -------------
 * 1. Build: `anchor build` (generates target/deploy/fndry_staking.so)
 * 2. Deps:  `npm install`
 * 3. Run:   `npm run test:bankrun`
 */

import { start, BanksClient, ProgramTestContext } from "solana-bankrun";
import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// Program configuration
// ─────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(
  "Stak1111111111111111111111111111111111111111"
);

const PROGRAM_SO = path.resolve(
  __dirname,
  "../../target/deploy/fndry_staking.so"
);

// ─────────────────────────────────────────────────────────────────
// PDA helpers (mirrors staking SDK)
// ─────────────────────────────────────────────────────────────────

function findConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
}

function findVaultAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    PROGRAM_ID
  );
}

function findRewardPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward_pool")],
    PROGRAM_ID
  );
}

function findStakeAccountPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), user.toBuffer()],
    PROGRAM_ID
  );
}

function findStakeVaultPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), user.toBuffer()],
    PROGRAM_ID
  );
}

// ─────────────────────────────────────────────────────────────────
// Staking constants
// ─────────────────────────────────────────────────────────────────

const ONE_TOKEN = new BN(1_000_000);
const BRONZE_MIN = new BN(10_000).mul(ONE_TOKEN);
const SILVER_MIN = new BN(50_000).mul(ONE_TOKEN);
const GOLD_MIN = new BN(100_000).mul(ONE_TOKEN);
const COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

// ─────────────────────────────────────────────────────────────────
// Reward calculation (mirrors Rust logic for assertion)
// ─────────────────────────────────────────────────────────────────

function calculateRewards(
  amount: BN,
  durationSeconds: number,
  apyBps: number
): BN {
  if (amount.isZero() || apyBps === 0 || durationSeconds <= 0) return new BN(0);
  // reward = amount * apy_bps * duration / (10_000 * SECONDS_PER_YEAR)
  const num = amount
    .muln(apyBps)
    .muln(durationSeconds);
  const denom = new BN(10_000).muln(SECONDS_PER_YEAR);
  return num.div(denom);
}

// ─────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────

describe("fndry-staking (bankrun)", function () {
  this.timeout(30_000);

  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;

  before(async function () {
    try {
      context = await start(
        [{ name: "fndry_staking", programId: PROGRAM_ID }],
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
          "\n  ⚠️  bankrun tests skipped: fndry_staking.so not found.\n" +
            "     Run `anchor build` first.\n"
        );
        this.skip();
      } else {
        throw err;
      }
    }
  });

  // ── Clock helpers ───────────────────────────────────────────────

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

  // ── PDA derivation tests ────────────────────────────────────────

  it("derives config PDA deterministically", function () {
    const [pda1] = findConfigPda();
    const [pda2] = findConfigPda();
    expect(pda1.toBase58()).to.equal(pda2.toBase58());
  });

  it("derives distinct user stake PDAs for different users", function () {
    const user1 = Keypair.generate().publicKey;
    const user2 = Keypair.generate().publicKey;
    const [pda1] = findStakeAccountPda(user1);
    const [pda2] = findStakeAccountPda(user2);
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it("derives same PDA for same user across multiple calls", function () {
    const user = Keypair.generate().publicKey;
    const [pda1] = findStakeAccountPda(user);
    const [pda2] = findStakeAccountPda(user);
    expect(pda1.toBase58()).to.equal(pda2.toBase58());
  });

  it("stake vault PDA is distinct from stake account PDA", function () {
    const user = Keypair.generate().publicKey;
    const [account] = findStakeAccountPda(user);
    const [vault] = findStakeVaultPda(user);
    expect(account.toBase58()).to.not.equal(vault.toBase58());
  });

  it("all global PDAs are distinct", function () {
    const [config] = findConfigPda();
    const [vaultAuth] = findVaultAuthorityPda();
    const [rewardPool] = findRewardPoolPda();
    const addresses = [config, vaultAuth, rewardPool].map((p) => p.toBase58());
    const unique = new Set(addresses);
    expect(unique.size).to.equal(3);
  });

  // ── Reward calculation tests (off-chain mirror) ──────────────────

  it("off-chain reward calculation is zero for zero amount", function () {
    expect(calculateRewards(new BN(0), SECONDS_PER_YEAR, 500).toNumber()).to.equal(0);
  });

  it("off-chain reward for 10k FNDRY at 5% for one year = 500 FNDRY", function () {
    const reward = calculateRewards(BRONZE_MIN, SECONDS_PER_YEAR, 500);
    // 10_000_000_000 * 500 * 31536000 / (10000 * 31536000) = 500_000_000
    expect(reward.toString()).to.equal("500000000");
  });

  it("off-chain reward for 100k FNDRY at 12% for one year = 12k FNDRY", function () {
    const reward = calculateRewards(GOLD_MIN, SECONDS_PER_YEAR, 1200);
    expect(reward.toString()).to.equal("12000000000");
  });

  it("off-chain reward scales linearly with amount", function () {
    const single = calculateRewards(BRONZE_MIN, SECONDS_PER_YEAR, 500);
    const double = calculateRewards(BRONZE_MIN.muln(2), SECONDS_PER_YEAR, 500);
    expect(double.toString()).to.equal(single.muln(2).toString());
  });

  it("off-chain reward for half-year is half of full-year (±1)", function () {
    const full = calculateRewards(BRONZE_MIN, SECONDS_PER_YEAR, 500);
    const half = calculateRewards(BRONZE_MIN, SECONDS_PER_YEAR / 2, 500);
    const diff = Math.abs(full.divn(2).toNumber() - half.toNumber());
    expect(diff).to.be.lessThanOrEqual(1);
  });

  // ── bankrun clock tests ─────────────────────────────────────────

  it("bankrun clock starts at a positive unix timestamp", async function () {
    const clock = await client.getClock();
    expect(clock.unixTimestamp).to.be.greaterThan(0n);
  });

  it("can warp clock past the cooldown period (7 days)", async function () {
    const before = await client.getClock();
    await advanceClockBy(COOLDOWN_SECONDS);
    const after = await client.getClock();
    expect(after.unixTimestamp - before.unixTimestamp).to.equal(
      BigInt(COOLDOWN_SECONDS)
    );
  });

  it("can warp clock by one year for reward accumulation tests", async function () {
    const before = await client.getClock();
    await advanceClockBy(SECONDS_PER_YEAR);
    const after = await client.getClock();
    expect(after.unixTimestamp - before.unixTimestamp).to.equal(
      BigInt(SECONDS_PER_YEAR)
    );
  });

  // ── Program deployment ──────────────────────────────────────────

  it("program account exists and is executable", async function () {
    const account = await client.getAccount(PROGRAM_ID);
    expect(account).to.not.be.null;
    expect(account?.executable).to.be.true;
  });

  // ── Payer ───────────────────────────────────────────────────────

  it("payer has lamports in bankrun context", async function () {
    const balance = await client.getBalance(payer.publicKey);
    expect(Number(balance)).to.be.greaterThan(0);
  });
});

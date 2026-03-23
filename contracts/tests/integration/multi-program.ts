/**
 * Multi-program integration test: bounty lifecycle ↔ staking tier.
 *
 * Scenario
 * --------
 * 1. Admin initialises the staking program.
 * 2. Contributor stakes $FNDRY tokens → earns a staking tier (e.g. Bronze).
 * 3. Admin registers a bounty in the bounty-registry.
 * 4. Admin claims the bounty on behalf of the contributor (Open → Claimed).
 * 5. Admin advances the bounty to InReview (Claimed → InReview).
 * 6. Admin records completion with review scores (InReview → Completed).
 * 7. Test asserts:
 *    - Bounty record shows Completed status and correct final score.
 *    - The contributor's stake account has the correct staked amount.
 *    - The contributor's wallet pubkey appears on both programs' records,
 *      proving the same identity crosses the multi-program boundary.
 *
 * This test requires BOTH programs to be deployed on the local validator.
 * Run via: anchor test --skip-deploy (if validator already running)
 *      or: anchor test (starts fresh validator)
 *
 * Note: Because the two programs are in separate Anchor workspaces, this
 * integration test demonstrates cross-program state coherence at the
 * account-data level (shared pubkeys), not via CPI calls.  Future work
 * can add a CPI bridge program once both programs share a workspace.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

import {
  airdropSol,
  createTestMint,
  createTokenAccount,
  fundTokenAccount,
  getTokenBalance,
  deriveBountyPda,
  deriveStakingPdas,
  deriveUserStakingPdas,
  mockPrHash,
  githubIssueUrl,
  githubPrUrl,
  defaultReviewScores,
  expectedFinalScore,
  confirmTx,
  BRONZE_MIN,
  GOLD_MIN,
  ONE_TOKEN,
} from "../helpers";

/** Program type aliases — replaced by generated IDLs after `anchor build`. */
type BountyRegistry = any;
type FndryStaking = any;

describe("Multi-program integration: bounty lifecycle + staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load both programs from the Anchor workspace.
  // NOTE: These must be deployed on the local validator before running.
  // If running in isolation, mock program instances can be used instead.
  let bountyProgram: Program<BountyRegistry>;
  let stakingProgram: Program<FndryStaking>;

  const admin = provider.wallet as anchor.Wallet;

  // Test actors
  let contributor: Keypair;
  let contributorTokenAccount: PublicKey;
  let tokenMint: PublicKey;

  // Staking PDAs
  let configPda: PublicKey;
  let vaultAuthority: PublicKey;
  let rewardPoolPda: PublicKey;
  let stakeAccountPda: PublicKey;
  let stakeVaultPda: PublicKey;

  // Bounty tracking
  let bountyId: number;
  let bountyPda: PublicKey;

  // ─────────────────────────────────────────────────────────────────
  // Setup
  // ─────────────────────────────────────────────────────────────────

  before(async function () {
    // Allow 60 seconds for full setup with two programs.
    this.timeout(60_000);

    try {
      bountyProgram = anchor.workspace.BountyRegistry as Program<BountyRegistry>;
      stakingProgram = anchor.workspace.FndryStaking as Program<FndryStaking>;
    } catch {
      // Programs not deployed — skip integration tests gracefully.
      console.log(
        "  ⚠️  Multi-program integration tests skipped: programs not in workspace.\n" +
          "     Run `anchor build && anchor test` from each contract directory first."
      );
      this.skip();
      return;
    }

    // Fund contributor keypair.
    contributor = Keypair.generate();
    await airdropSol(provider, contributor.publicKey, 20);

    // Create $FNDRY token mint.
    tokenMint = await createTestMint(provider);

    // Create token accounts.
    contributorTokenAccount = await createTokenAccount(
      provider,
      tokenMint,
      contributor.publicKey
    );

    // Mint enough tokens for Gold tier + rewards.
    const mintAmount = GOLD_MIN.muln(3);
    await fundTokenAccount(provider, tokenMint, contributorTokenAccount, mintAmount);

    // Derive staking PDAs.
    const stakingPdas = deriveStakingPdas(stakingProgram.programId);
    configPda = stakingPdas.configPda;
    vaultAuthority = stakingPdas.vaultAuthority;
    rewardPoolPda = stakingPdas.rewardPoolPda;

    const userPdas = deriveUserStakingPdas(
      contributor.publicKey,
      stakingProgram.programId
    );
    stakeAccountPda = userPdas.stakeAccountPda;
    stakeVaultPda = userPdas.stakeVaultPda;

    // Derive bounty PDA.
    bountyId = Date.now() % 1_000_000; // unique per run
    [bountyPda] = deriveBountyPda(bountyId, bountyProgram.programId);
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 1: Initialise staking program
  // ─────────────────────────────────────────────────────────────────

  it("step 1: initialises the staking program", async function () {
    this.timeout(20_000);

    const tx = await stakingProgram.methods
      .initialize()
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        tokenMint,
        vaultAuthority,
        rewardPoolVault: rewardPoolPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    await confirmTx(provider, tx);

    const config = await stakingProgram.account.stakingConfig.fetch(configPda);
    expect(config.admin.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(config.paused).to.be.false;
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 2: Contributor stakes tokens (Bronze tier)
  // ─────────────────────────────────────────────────────────────────

  it("step 2: contributor stakes Bronze-tier tokens", async function () {
    this.timeout(20_000);

    const tx = await stakingProgram.methods
      .stake(BRONZE_MIN)
      .accounts({
        user: contributor.publicKey,
        config: configPda,
        stakeAccount: stakeAccountPda,
        tokenMint,
        userTokenAccount: contributorTokenAccount,
        stakeVault: stakeVaultPda,
        vaultAuthority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([contributor])
      .rpc();
    await confirmTx(provider, tx);

    const stake = await stakingProgram.account.stakeAccount.fetch(stakeAccountPda);
    expect(stake.owner.toBase58()).to.equal(contributor.publicKey.toBase58());
    expect(stake.amount.toString()).to.equal(BRONZE_MIN.toString());
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 3: Admin registers a bounty in the registry
  // ─────────────────────────────────────────────────────────────────

  it("step 3: admin registers a tier-2 bounty", async function () {
    this.timeout(20_000);

    const tx = await bountyProgram.methods
      .registerBounty(
        new BN(bountyId),
        "Integration test bounty — real on-chain",
        2, // tier
        new BN(500_000),
        githubIssueUrl(bountyId)
      )
      .accounts({
        admin: admin.publicKey,
        bountyRecord: bountyPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await confirmTx(provider, tx);

    const record = await bountyProgram.account.bountyRecord.fetch(bountyPda);
    expect(record.status).to.deep.include({ open: {} });
    expect(record.creator.toBase58()).to.equal(admin.publicKey.toBase58());
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 4: Claim bounty (Open → Claimed, contributor assigned)
  // ─────────────────────────────────────────────────────────────────

  it("step 4: admin claims bounty on behalf of contributor", async function () {
    this.timeout(20_000);

    const tx = await bountyProgram.methods
      .updateStatus(1, contributor.publicKey)
      .accounts({
        admin: admin.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
    await confirmTx(provider, tx);

    const record = await bountyProgram.account.bountyRecord.fetch(bountyPda);
    expect(record.status).to.deep.include({ claimed: {} });
    expect(record.contributor.toBase58()).to.equal(
      contributor.publicKey.toBase58()
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 5: Advance to InReview (Claimed → InReview)
  // ─────────────────────────────────────────────────────────────────

  it("step 5: admin advances bounty to InReview", async function () {
    this.timeout(20_000);

    const tx = await bountyProgram.methods
      .updateStatus(2, null)
      .accounts({
        admin: admin.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
    await confirmTx(provider, tx);

    const record = await bountyProgram.account.bountyRecord.fetch(bountyPda);
    expect(record.status).to.deep.include({ inReview: {} });
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 6: Record completion with review scores
  // ─────────────────────────────────────────────────────────────────

  it("step 6: admin records bounty completion with AI review scores", async function () {
    this.timeout(20_000);

    const scores = defaultReviewScores(); // [850, 900, 750, 800, 950]
    const prHash = mockPrHash("integration-test-pr");
    const prUrl = githubPrUrl(bountyId);

    const tx = await bountyProgram.methods
      .recordCompletion(scores, prHash, prUrl)
      .accounts({
        admin: admin.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
    await confirmTx(provider, tx);

    const record = await bountyProgram.account.bountyRecord.fetch(bountyPda);

    expect(record.status).to.deep.include({ completed: {} });
    expect(record.githubPr).to.equal(prUrl);
    expect(record.reviewScores).to.deep.equal(scores);
    expect(record.completedAt.toNumber()).to.be.greaterThan(0);

    // Verify final score equals average of the five review scores.
    const expectedScore = expectedFinalScore(scores);
    expect(record.finalScore).to.equal(expectedScore);
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 7: Cross-program state coherence assertions
  // ─────────────────────────────────────────────────────────────────

  it("step 7: contributor pubkey is consistent across both programs", async function () {
    this.timeout(20_000);

    // Bounty record: contributor matches the keypair that staked.
    const bountyRecord = await bountyProgram.account.bountyRecord.fetch(bountyPda);
    const stakeRecord = await stakingProgram.account.stakeAccount.fetch(stakeAccountPda);

    expect(bountyRecord.contributor.toBase58()).to.equal(
      stakeRecord.owner.toBase58(),
      "Contributor pubkey must be the same across bounty and staking records"
    );

    // Both records reference the same keypair that signed transactions.
    expect(stakeRecord.owner.toBase58()).to.equal(
      contributor.publicKey.toBase58()
    );
  });

  it("step 7b: bounty is in terminal Completed state", async function () {
    const record = await bountyProgram.account.bountyRecord.fetch(bountyPda);
    expect(record.status).to.deep.include({ completed: {} });
    expect(record.completedAt).to.not.be.null;
  });

  it("step 7c: contributor stake is still active after bounty completion", async function () {
    const stake = await stakingProgram.account.stakeAccount.fetch(stakeAccountPda);
    // Staked amount unchanged — completing a bounty does not touch the stake.
    expect(stake.amount.toString()).to.equal(BRONZE_MIN.toString());
    expect(stake.cooldownActive).to.be.false;
  });
});

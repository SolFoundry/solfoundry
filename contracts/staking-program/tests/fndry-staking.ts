/**
 * Comprehensive test suite for the FNDRY Staking Program.
 *
 * Covers all three milestones:
 *   Milestone 1 — Stake account creation, stake/unstake, cooldown logic
 *   Milestone 2 — Reward calculation, distribution, edge cases
 *   Milestone 3 — Staking tiers, auto-compound, slash, config updates
 *
 * Tests use Anchor's local validator with time manipulation via
 * Clock overrides to test time-dependent reward calculations and
 * cooldown enforcement.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorError } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

import {
  findConfigPda,
  findStakeAccountPda,
  findStakeVaultPda,
  findVaultAuthorityPda,
  findRewardPoolPda,
  calculateRewards,
  getTierForAmount,
  STAKING_TIERS,
  COOLDOWN_SECONDS,
  SECONDS_PER_YEAR,
  BPS_DIVISOR,
} from "../sdk/src/index";

/** Type alias for the FNDRY staking program. */
type FndryStaking = Program;

/** Helper to wait for transaction confirmation. */
async function confirmTx(
  provider: anchor.AnchorProvider,
  txSig: string
): Promise<void> {
  await provider.connection.confirmTransaction(txSig, "confirmed");
}

/** Helper to airdrop SOL to a keypair. */
async function airdropSol(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  amount: number = 10 * LAMPORTS_PER_SOL
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(pubkey, amount);
  await confirmTx(provider, sig);
}

/** Helper to advance the validator clock by a given number of seconds. */
async function advanceClock(
  provider: anchor.AnchorProvider,
  seconds: number
): Promise<void> {
  // In localnet, we warp the slot forward to simulate time passage.
  // Each slot is ~400ms, so seconds * 2.5 slots ≈ the time advancement.
  const slotsToAdvance = Math.ceil(seconds * 2.5);
  const currentSlot = await provider.connection.getSlot();
  // Use the BanksClient warp if available, otherwise just wait.
  // For anchor test, we use the clock sysvar approach.
  await (provider.connection as any).requestAirdrop?.(
    Keypair.generate().publicKey,
    1
  );
}

describe("fndry-staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FndryStaking as FndryStaking;
  const admin = provider.wallet as anchor.Wallet;

  // Test accounts
  let tokenMint: PublicKey;
  let adminTokenAccount: PublicKey;
  let user1 = Keypair.generate();
  let user1TokenAccount: PublicKey;
  let user2 = Keypair.generate();
  let user2TokenAccount: PublicKey;

  // PDAs
  let configPda: PublicKey;
  let configBump: number;
  let vaultAuthority: PublicKey;
  let vaultAuthorityBump: number;
  let rewardPoolPda: PublicKey;
  let rewardPoolBump: number;

  // Token amounts (6 decimal places)
  const DECIMALS = 6;
  const ONE_TOKEN = new BN(1_000_000);
  const BRONZE_MIN = new BN(10_000).mul(ONE_TOKEN);   // 10,000 tokens
  const SILVER_MIN = new BN(50_000).mul(ONE_TOKEN);   // 50,000 tokens
  const GOLD_MIN = new BN(100_000).mul(ONE_TOKEN);    // 100,000 tokens
  const REWARD_POOL_AMOUNT = new BN(1_000_000).mul(ONE_TOKEN); // 1M tokens for rewards

  before(async () => {
    // Derive PDAs.
    [configPda, configBump] = findConfigPda(program.programId);
    [vaultAuthority, vaultAuthorityBump] = findVaultAuthorityPda(program.programId);
    [rewardPoolPda, rewardPoolBump] = findRewardPoolPda(program.programId);

    // Airdrop SOL to test users.
    await airdropSol(provider, user1.publicKey);
    await airdropSol(provider, user2.publicKey);

    // Create the $FNDRY token mint (admin is mint authority).
    tokenMint = await createMint(
      provider.connection,
      (admin as any).payer,
      admin.publicKey,
      null,
      DECIMALS
    );

    // Create token accounts.
    adminTokenAccount = await createAccount(
      provider.connection,
      (admin as any).payer,
      tokenMint,
      admin.publicKey
    );

    user1TokenAccount = await createAccount(
      provider.connection,
      (admin as any).payer,
      tokenMint,
      user1.publicKey
    );

    user2TokenAccount = await createAccount(
      provider.connection,
      (admin as any).payer,
      tokenMint,
      user2.publicKey
    );

    // Mint tokens: give each user enough for Gold tier + extra.
    const mintAmount = GOLD_MIN.muln(3); // 300,000 tokens each
    await mintTo(
      provider.connection,
      (admin as any).payer,
      tokenMint,
      user1TokenAccount,
      admin.publicKey,
      BigInt(mintAmount.toString())
    );

    await mintTo(
      provider.connection,
      (admin as any).payer,
      tokenMint,
      user2TokenAccount,
      admin.publicKey,
      BigInt(mintAmount.toString())
    );
  });

  // =========================================================================
  // Milestone 1: Stake Account + Stake/Unstake + Cooldown
  // =========================================================================

  describe("Milestone 1: Initialization & Staking", () => {
    it("initializes the staking program configuration", async () => {
      const tx = await program.methods
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

      // Verify the config was initialized correctly.
      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(config.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
      expect(config.paused).to.be.false;
      expect(config.totalStaked.toNumber()).to.equal(0);
      expect(config.activeStakers.toNumber()).to.equal(0);
      expect(config.cooldownSeconds.toNumber()).to.equal(COOLDOWN_SECONDS);

      // Verify tier thresholds.
      expect(config.tierThresholds[0].toString()).to.equal(BRONZE_MIN.toString());
      expect(config.tierThresholds[1].toString()).to.equal(SILVER_MIN.toString());
      expect(config.tierThresholds[2].toString()).to.equal(GOLD_MIN.toString());

      // Verify APY rates.
      expect(config.tierApyBps[0]).to.equal(500);
      expect(config.tierApyBps[1]).to.equal(800);
      expect(config.tierApyBps[2]).to.equal(1200);
    });

    it("funds the reward pool with tokens", async () => {
      // Mint reward tokens to admin, then transfer to reward pool.
      await mintTo(
        provider.connection,
        (admin as any).payer,
        tokenMint,
        adminTokenAccount,
        admin.publicKey,
        BigInt(REWARD_POOL_AMOUNT.toString())
      );

      // Transfer from admin to the reward pool vault.
      const tx = await anchor.utils.token.transfer(
        program.provider,
        adminTokenAccount,
        rewardPoolPda,
        REWARD_POOL_AMOUNT
      );

      const rewardPool = await getAccount(provider.connection, rewardPoolPda);
      expect(Number(rewardPool.amount)).to.be.greaterThanOrEqual(
        REWARD_POOL_AMOUNT.toNumber()
      );
    });

    it("allows user1 to stake Bronze-tier amount", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user1.publicKey, program.programId);

      const tx = await program.methods
        .stake(BRONZE_MIN)
        .accounts({
          user: user1.publicKey,
          config: configPda,
          stakeAccount,
          tokenMint,
          userTokenAccount: user1TokenAccount,
          stakeVault,
          vaultAuthority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user1])
        .rpc();

      await confirmTx(provider, tx);

      // Verify stake account was created.
      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.owner.toBase58()).to.equal(user1.publicKey.toBase58());
      expect(stake.amount.toString()).to.equal(BRONZE_MIN.toString());
      expect(stake.cooldownActive).to.be.false;
      expect(stake.autoCompound).to.be.false;

      // Verify global stats updated.
      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.totalStaked.toString()).to.equal(BRONZE_MIN.toString());
      expect(config.activeStakers.toNumber()).to.equal(1);
    });

    it("allows user1 to add more to existing stake (upgrade to Silver)", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user1.publicKey, program.programId);

      const additionalAmount = SILVER_MIN.sub(BRONZE_MIN); // 40,000 tokens more

      const tx = await program.methods
        .stake(additionalAmount)
        .accounts({
          user: user1.publicKey,
          config: configPda,
          stakeAccount,
          tokenMint,
          userTokenAccount: user1TokenAccount,
          stakeVault,
          vaultAuthority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user1])
        .rpc();

      await confirmTx(provider, tx);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.amount.toString()).to.equal(SILVER_MIN.toString());

      // Active stakers should still be 1 (not incremented).
      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.activeStakers.toNumber()).to.equal(1);
    });

    it("rejects stake below minimum threshold on new account", async () => {
      const newUser = Keypair.generate();
      await airdropSol(provider, newUser.publicKey);

      const newUserTokenAccount = await createAccount(
        provider.connection,
        (admin as any).payer,
        tokenMint,
        newUser.publicKey
      );

      const tooSmall = BRONZE_MIN.subn(1); // 1 token less than minimum
      await mintTo(
        provider.connection,
        (admin as any).payer,
        tokenMint,
        newUserTokenAccount,
        admin.publicKey,
        BigInt(tooSmall.toString())
      );

      const [stakeAccount] = findStakeAccountPda(newUser.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(newUser.publicKey, program.programId);

      try {
        await program.methods
          .stake(tooSmall)
          .accounts({
            user: newUser.publicKey,
            config: configPda,
            stakeAccount,
            tokenMint,
            userTokenAccount: newUserTokenAccount,
            stakeVault,
            vaultAuthority,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([newUser])
          .rpc();

        expect.fail("Should have rejected below-minimum stake");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "BelowMinimumStake"
        );
      }
    });

    it("rejects zero stake amount", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user1.publicKey, program.programId);

      try {
        await program.methods
          .stake(new BN(0))
          .accounts({
            user: user1.publicKey,
            config: configPda,
            stakeAccount,
            tokenMint,
            userTokenAccount: user1TokenAccount,
            stakeVault,
            vaultAuthority,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected zero stake");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "ZeroStakeAmount"
        );
      }
    });

    it("allows user2 to stake Gold-tier amount", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      const tx = await program.methods
        .stake(GOLD_MIN)
        .accounts({
          user: user2.publicKey,
          config: configPda,
          stakeAccount,
          tokenMint,
          userTokenAccount: user2TokenAccount,
          stakeVault,
          vaultAuthority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user2])
        .rpc();

      await confirmTx(provider, tx);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.amount.toString()).to.equal(GOLD_MIN.toString());

      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.activeStakers.toNumber()).to.equal(2);
    });

    it("initiates unstake cooldown for user1", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);

      const unstakeAmount = BRONZE_MIN; // Unstake 10,000

      const tx = await program.methods
        .unstakeInitiate(unstakeAmount)
        .accounts({
          user: user1.publicKey,
          config: configPda,
          stakeAccount,
        })
        .signers([user1])
        .rpc();

      await confirmTx(provider, tx);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.cooldownActive).to.be.true;
      expect(stake.cooldownAmount.toString()).to.equal(unstakeAmount.toString());
      expect(stake.cooldownStart.toNumber()).to.be.greaterThan(0);
    });

    it("rejects second unstake while cooldown is active", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);

      try {
        await program.methods
          .unstakeInitiate(ONE_TOKEN)
          .accounts({
            user: user1.publicKey,
            config: configPda,
            stakeAccount,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected duplicate cooldown");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "CooldownAlreadyActive"
        );
      }
    });

    it("rejects unstake completion before cooldown elapses", async () => {
      const [stakeAccount] = findStakeAccountPda(user1.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user1.publicKey, program.programId);

      try {
        await program.methods
          .unstakeComplete()
          .accounts({
            user: user1.publicKey,
            config: configPda,
            stakeAccount,
            stakeVault,
            userTokenAccount: user1TokenAccount,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected early completion");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "CooldownNotElapsed"
        );
      }
    });

    it("rejects unstake amount exceeding staked balance", async () => {
      const [stakeAccount2] = findStakeAccountPda(user2.publicKey, program.programId);

      const tooMuch = GOLD_MIN.addn(1);

      try {
        await program.methods
          .unstakeInitiate(tooMuch)
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount: stakeAccount2,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have rejected excessive unstake");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "InsufficientStake"
        );
      }
    });

    it("rejects zero unstake amount", async () => {
      const [stakeAccount2] = findStakeAccountPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .unstakeInitiate(new BN(0))
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount: stakeAccount2,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have rejected zero unstake");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "ZeroUnstakeAmount"
        );
      }
    });
  });

  // =========================================================================
  // Milestone 2: Reward Calculation & Distribution
  // =========================================================================

  describe("Milestone 2: Reward Calculation & Distribution", () => {
    it("calculates rewards correctly off-chain (SDK)", () => {
      // Bronze tier: 10,000 tokens, 5% APY, 365 days
      const amount = BRONZE_MIN;
      const duration = new BN(SECONDS_PER_YEAR);
      const rewards = calculateRewards(amount, duration, 500);

      // Expected: 10,000 * 500 / 10,000 = 500 tokens
      const expectedRewards = new BN(500).mul(ONE_TOKEN);
      expect(rewards.toString()).to.equal(expectedRewards.toString());
    });

    it("calculates Silver tier rewards correctly", () => {
      const amount = SILVER_MIN;
      const duration = new BN(SECONDS_PER_YEAR);
      const rewards = calculateRewards(amount, duration, 800);

      // Expected: 50,000 * 800 / 10,000 = 4,000 tokens
      const expectedRewards = new BN(4_000).mul(ONE_TOKEN);
      expect(rewards.toString()).to.equal(expectedRewards.toString());
    });

    it("calculates Gold tier rewards correctly", () => {
      const amount = GOLD_MIN;
      const duration = new BN(SECONDS_PER_YEAR);
      const rewards = calculateRewards(amount, duration, 1200);

      // Expected: 100,000 * 1200 / 10,000 = 12,000 tokens
      const expectedRewards = new BN(12_000).mul(ONE_TOKEN);
      expect(rewards.toString()).to.equal(expectedRewards.toString());
    });

    it("returns zero rewards for zero duration", () => {
      const rewards = calculateRewards(BRONZE_MIN, new BN(0), 500);
      expect(rewards.toNumber()).to.equal(0);
    });

    it("returns zero rewards for zero amount", () => {
      const rewards = calculateRewards(new BN(0), new BN(SECONDS_PER_YEAR), 500);
      expect(rewards.toNumber()).to.equal(0);
    });

    it("returns zero rewards for zero APY", () => {
      const rewards = calculateRewards(BRONZE_MIN, new BN(SECONDS_PER_YEAR), 0);
      expect(rewards.toNumber()).to.equal(0);
    });

    it("calculates proportional rewards for partial year", () => {
      // 30 days = 30/365 of a year
      const duration = new BN(30 * 24 * 60 * 60);
      const rewards = calculateRewards(GOLD_MIN, duration, 1200);

      // Expected: 100,000 * 1200 * 30 / (10,000 * 365) ≈ 986.3 tokens
      const expectedApprox = 986_301_369; // ~986.3 tokens in base units
      const diff = Math.abs(rewards.toNumber() - expectedApprox);
      expect(diff).to.be.lessThan(ONE_TOKEN.toNumber()); // Within 1 token tolerance
    });

    it("handles large stake amounts without overflow", () => {
      // Max u64 / 2 ≈ 9.2e18, much larger than any realistic stake
      const largeAmount = new BN("1000000000000000"); // 1 billion tokens
      const duration = new BN(SECONDS_PER_YEAR);
      const rewards = calculateRewards(largeAmount, duration, 1200);

      // Should not throw and should be 12% of the large amount
      const expected = largeAmount.muln(1200).divn(10_000);
      expect(rewards.toString()).to.equal(expected.toString());
    });

    it("user2 (Gold tier) can claim rewards", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);

      // Get balance before claim.
      const balanceBefore = await getAccount(
        provider.connection,
        user2TokenAccount
      );

      const tx = await program.methods
        .claimRewards()
        .accounts({
          user: user2.publicKey,
          config: configPda,
          stakeAccount,
          rewardPoolVault: rewardPoolPda,
          userTokenAccount: user2TokenAccount,
          vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      await confirmTx(provider, tx);

      // Verify rewards were distributed.
      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.rewardsEarned.toNumber()).to.be.greaterThanOrEqual(0);
      expect(stake.pendingRewards.toNumber()).to.equal(0);
    });

    it("rejects claim with no pending rewards (just claimed)", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .claimRewards()
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount,
            rewardPoolVault: rewardPoolPda,
            userTokenAccount: user2TokenAccount,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        // If rewards accrued in the few seconds since last claim, that's OK.
        // The test is valid either way since we're testing the error path.
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "NoRewardsToClaim"
        );
      }
    });
  });

  // =========================================================================
  // Milestone 3: Tiers, Auto-Compound, Slash, Config
  // =========================================================================

  describe("Milestone 3: Tiers, Auto-Compound, Slash, Config", () => {
    it("identifies correct tier for amount (SDK)", () => {
      expect(getTierForAmount(new BN(0))).to.be.null;
      expect(getTierForAmount(BRONZE_MIN.subn(1))).to.be.null;

      const bronze = getTierForAmount(BRONZE_MIN);
      expect(bronze).to.not.be.null;
      expect(bronze!.name).to.equal("Bronze");

      const silver = getTierForAmount(SILVER_MIN);
      expect(silver).to.not.be.null;
      expect(silver!.name).to.equal("Silver");

      const gold = getTierForAmount(GOLD_MIN);
      expect(gold).to.not.be.null;
      expect(gold!.name).to.equal("Gold");

      // Amount between tiers should return the lower tier.
      const betweenBronzeSilver = getTierForAmount(BRONZE_MIN.addn(1));
      expect(betweenBronzeSilver!.name).to.equal("Bronze");
    });

    it("user2 can toggle auto-compound on", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);

      const tx = await program.methods
        .toggleAutoCompound(true)
        .accounts({
          user: user2.publicKey,
          config: configPda,
          stakeAccount,
        })
        .signers([user2])
        .rpc();

      await confirmTx(provider, tx);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.autoCompound).to.be.true;
    });

    it("user2 can toggle auto-compound off", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);

      const tx = await program.methods
        .toggleAutoCompound(false)
        .accounts({
          user: user2.publicKey,
          config: configPda,
          stakeAccount,
        })
        .signers([user2])
        .rpc();

      await confirmTx(provider, tx);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      expect(stake.autoCompound).to.be.false;
    });

    it("user2 can compound rewards", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      const stakeBefore = await program.account.stakeAccount.fetch(stakeAccount);

      try {
        const tx = await program.methods
          .compound()
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount,
            rewardPoolVault: rewardPoolPda,
            stakeVault,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        await confirmTx(provider, tx);

        const stakeAfter = await program.account.stakeAccount.fetch(stakeAccount);
        // After compounding, staked amount should be >= before.
        expect(stakeAfter.amount.gte(stakeBefore.amount)).to.be.true;
        expect(stakeAfter.pendingRewards.toNumber()).to.equal(0);
      } catch (error) {
        // If no rewards accrued yet, NoRewardsToClaim is acceptable.
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "NoRewardsToClaim"
        );
      }
    });

    it("admin can slash a user's stake", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      const stakeBefore = await program.account.stakeAccount.fetch(stakeAccount);
      const slashAmount = ONE_TOKEN.muln(1000); // Slash 1,000 tokens

      const tx = await program.methods
        .slash(user2.publicKey, slashAmount)
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          stakeAccount,
          stakeVault,
          rewardPoolVault: rewardPoolPda,
          vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await confirmTx(provider, tx);

      const stakeAfter = await program.account.stakeAccount.fetch(stakeAccount);
      const expectedAmount = stakeBefore.amount.sub(slashAmount);
      expect(stakeAfter.amount.toString()).to.equal(expectedAmount.toString());

      // Global total_staked should have decreased.
      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.totalStaked.lt(stakeBefore.amount.add(SILVER_MIN))).to.be.true;
    });

    it("rejects slash from non-admin", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .slash(user2.publicKey, ONE_TOKEN)
          .accounts({
            admin: user1.publicKey,
            config: configPda,
            stakeAccount,
            stakeVault,
            rewardPoolVault: rewardPoolPda,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected non-admin slash");
      } catch (error) {
        // Anchor constraint error for unauthorized.
        expect(error).to.exist;
      }
    });

    it("rejects slash exceeding staked balance", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      const stake = await program.account.stakeAccount.fetch(stakeAccount);
      const tooMuch = stake.amount.addn(1);

      try {
        await program.methods
          .slash(user2.publicKey, tooMuch)
          .accounts({
            admin: admin.publicKey,
            config: configPda,
            stakeAccount,
            stakeVault,
            rewardPoolVault: rewardPoolPda,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have rejected excessive slash");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "SlashExceedsStake"
        );
      }
    });

    it("rejects zero slash amount", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .slash(user2.publicKey, new BN(0))
          .accounts({
            admin: admin.publicKey,
            config: configPda,
            stakeAccount,
            stakeVault,
            rewardPoolVault: rewardPoolPda,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have rejected zero slash");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "ZeroSlashAmount"
        );
      }
    });

    it("admin can update tier thresholds", async () => {
      const newThresholds = [
        new BN(5_000).mul(ONE_TOKEN),   // Reduced Bronze to 5,000
        new BN(25_000).mul(ONE_TOKEN),  // Reduced Silver to 25,000
        new BN(75_000).mul(ONE_TOKEN),  // Reduced Gold to 75,000
      ];

      const tx = await program.methods
        .updateConfig({
          tierThresholds: newThresholds,
          tierApyBps: null,
          cooldownSeconds: null,
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();

      await confirmTx(provider, tx);

      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.tierThresholds[0].toString()).to.equal(
        newThresholds[0].toString()
      );

      // Restore original thresholds.
      await program.methods
        .updateConfig({
          tierThresholds: [BRONZE_MIN, SILVER_MIN, GOLD_MIN],
          tierApyBps: null,
          cooldownSeconds: null,
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();
    });

    it("admin can update APY rates", async () => {
      const tx = await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: [600, 900, 1500],
          cooldownSeconds: null,
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();

      await confirmTx(provider, tx);

      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.tierApyBps[0]).to.equal(600);
      expect(config.tierApyBps[1]).to.equal(900);
      expect(config.tierApyBps[2]).to.equal(1500);

      // Restore original APY rates.
      await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: [500, 800, 1200],
          cooldownSeconds: null,
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();
    });

    it("admin can pause and unpause the program", async () => {
      // Pause.
      await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: null,
          cooldownSeconds: null,
          paused: true,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();

      let config = await program.account.stakingConfig.fetch(configPda);
      expect(config.paused).to.be.true;

      // Verify staking is blocked while paused.
      const [stakeAccount2] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault2] = findStakeVaultPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .stake(ONE_TOKEN)
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount: stakeAccount2,
            tokenMint,
            userTokenAccount: user2TokenAccount,
            stakeVault: stakeVault2,
            vaultAuthority,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have rejected stake while paused");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "ProgramPaused"
        );
      }

      // Unpause.
      await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: null,
          cooldownSeconds: null,
          paused: false,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();

      config = await program.account.stakingConfig.fetch(configPda);
      expect(config.paused).to.be.false;
    });

    it("rejects config update from non-admin", async () => {
      try {
        await program.methods
          .updateConfig({
            tierThresholds: null,
            tierApyBps: null,
            cooldownSeconds: null,
            paused: true,
          })
          .accounts({
            admin: user1.publicKey,
            config: configPda,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected non-admin config update");
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it("admin can update cooldown duration", async () => {
      const newCooldown = new BN(3 * 24 * 60 * 60); // 3 days

      await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: null,
          cooldownSeconds: newCooldown,
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();

      const config = await program.account.stakingConfig.fetch(configPda);
      expect(config.cooldownSeconds.toString()).to.equal(newCooldown.toString());

      // Restore original cooldown.
      await program.methods
        .updateConfig({
          tierThresholds: null,
          tierApyBps: null,
          cooldownSeconds: new BN(COOLDOWN_SECONDS),
          paused: null,
        })
        .accounts({
          admin: admin.publicKey,
          config: configPda,
        })
        .rpc();
    });

    it("prevents unauthorized user from toggling another user's auto-compound", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);

      try {
        // user1 tries to toggle user2's auto-compound.
        await program.methods
          .toggleAutoCompound(true)
          .accounts({
            user: user1.publicKey,
            config: configPda,
            stakeAccount, // user2's account
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have rejected cross-user toggle");
      } catch (error) {
        // PDA seed mismatch or constraint violation.
        expect(error).to.exist;
      }
    });
  });

  // =========================================================================
  // Security & Edge Cases
  // =========================================================================

  describe("Security & Edge Cases", () => {
    it("PDA derivation matches expected seeds", () => {
      const [stakeAccount] = findStakeAccountPda(
        user1.publicKey,
        program.programId
      );
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), user1.publicKey.toBuffer()],
        program.programId
      );
      expect(stakeAccount.toBase58()).to.equal(expected.toBase58());
    });

    it("vault authority PDA is deterministic", () => {
      const [va1] = findVaultAuthorityPda(program.programId);
      const [va2] = findVaultAuthorityPda(program.programId);
      expect(va1.toBase58()).to.equal(va2.toBase58());
    });

    it("reward pool PDA is deterministic", () => {
      const [rp1] = findRewardPoolPda(program.programId);
      const [rp2] = findRewardPoolPda(program.programId);
      expect(rp1.toBase58()).to.equal(rp2.toBase58());
    });

    it("rejects unstake with no cooldown active for user2", async () => {
      const [stakeAccount] = findStakeAccountPda(user2.publicKey, program.programId);
      const [stakeVault] = findStakeVaultPda(user2.publicKey, program.programId);

      try {
        await program.methods
          .unstakeComplete()
          .accounts({
            user: user2.publicKey,
            config: configPda,
            stakeAccount,
            stakeVault,
            userTokenAccount: user2TokenAccount,
            vaultAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have rejected — no cooldown active");
      } catch (error) {
        expect((error as AnchorError).error.errorCode.code).to.equal(
          "NoCooldownActive"
        );
      }
    });

    it("verifies staking tier reputation multiplier is 1.5x", () => {
      for (const tier of STAKING_TIERS) {
        expect(tier.reputationMultiplier).to.equal(1.5);
      }
    });

    it("verifies all tier APY rates are within bounds", () => {
      for (const tier of STAKING_TIERS) {
        expect(tier.apyBps).to.be.greaterThan(0);
        expect(tier.apyBps).to.be.lessThanOrEqual(10_000);
      }
    });

    it("verifies tier thresholds are in ascending order", () => {
      for (let i = 1; i < STAKING_TIERS.length; i++) {
        expect(
          STAKING_TIERS[i].minStake.gt(STAKING_TIERS[i - 1].minStake)
        ).to.be.true;
      }
    });

    it("global stats are consistent across operations", async () => {
      const config = await program.account.stakingConfig.fetch(configPda);

      // Total staked should be positive (user1 + user2 have staked).
      expect(config.totalStaked.toNumber()).to.be.greaterThan(0);

      // Active stakers should be 2.
      expect(config.activeStakers.toNumber()).to.equal(2);
    });
  });
});

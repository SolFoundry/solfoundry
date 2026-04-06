//! Stake $FNDRY tokens instruction.
//!
//! Transfers tokens from the user's wallet into a PDA-controlled
//! escrow account. Creates the [`StakeAccount`] on first stake or
//! adds to an existing position. Emits a [`StakeEvent`].

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::StakingError;
use crate::events::StakeEvent;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `stake` instruction.
#[derive(Accounts)]
pub struct Stake<'info> {
    /// The user staking their tokens.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
    )]
    pub config: Box<Account<'info, StakingConfig>>,

    /// Per-user stake account PDA.
    /// Seeds: `["stake", user_pubkey]`.
    /// Created on first stake via `init_if_needed`.
    #[account(
        init_if_needed,
        payer = user,
        space = StakeAccount::SPACE,
        seeds = [b"stake", user.key().as_ref()],
        bump,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    /// The $FNDRY token mint.
    #[account(
        constraint = token_mint.key() == config.token_mint @ StakingError::Unauthorized,
    )]
    pub token_mint: Account<'info, Mint>,

    /// The user's $FNDRY token account (source of staked tokens).
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::Unauthorized,
        constraint = user_token_account.mint == config.token_mint @ StakingError::Unauthorized,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// PDA-owned escrow vault that holds staked tokens.
    /// Seeds: `["stake_vault", user_pubkey]`.
    #[account(
        init_if_needed,
        payer = user,
        token::mint = token_mint,
        token::authority = vault_authority,
        seeds = [b"stake_vault", user.key().as_ref()],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// Vault authority PDA that controls the stake vault.
    /// Seeds: `["vault_authority"]`.
    /// CHECK: PDA used as token account authority, validated by seeds.
    #[account(
        seeds = [b"vault_authority"],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Solana system program.
    pub system_program: Program<'info, System>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,

    /// Rent sysvar for account creation.
    pub rent: Sysvar<'info, Rent>,
}

/// Stakes the specified amount of $FNDRY tokens.
///
/// # Arguments
///
/// * `ctx` - The instruction context with validated accounts.
/// * `amount` - Number of $FNDRY tokens to stake (in base units, 6 decimals).
///
/// # Flow
///
/// 1. Validates the program is not paused and amount > 0.
/// 2. Accrues any pending rewards on the existing stake before modifying.
/// 3. Transfers tokens from user's wallet to the PDA-owned stake vault.
/// 4. Updates the stake account balance and timestamps.
/// 5. Verifies the new total meets at least the Bronze tier threshold.
/// 6. Emits a [`StakeEvent`].
///
/// # Errors
///
/// - [`StakingError::ProgramPaused`] if the program is paused.
/// - [`StakingError::ZeroStakeAmount`] if amount is 0.
/// - [`StakingError::BelowMinimumStake`] if the total falls below Bronze.
/// - [`StakingError::MathOverflow`] on arithmetic overflow.
pub fn handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, StakingError::ProgramPaused);
    require!(amount > 0, StakingError::ZeroStakeAmount);

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    let stake_account = &mut ctx.accounts.stake_account;

    // Accrue pending rewards before modifying the stake balance.
    if stake_account.amount > 0 && stake_account.last_claim > 0 {
        let accrued = calculate_rewards(
            stake_account.amount,
            stake_account.last_claim,
            current_timestamp,
            config.apy_bps_for_amount(stake_account.amount),
        )?;
        stake_account.pending_rewards = stake_account
            .pending_rewards
            .checked_add(accrued)
            .ok_or(StakingError::MathOverflow)?;
    }

    // Transfer tokens from user to the stake vault.
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    // Update stake account state.
    let is_new_staker = stake_account.amount == 0;
    if is_new_staker {
        stake_account.owner = ctx.accounts.user.key();
        stake_account.staked_at = current_timestamp;
        stake_account.bump = ctx.bumps.stake_account;
    }

    stake_account.amount = stake_account
        .amount
        .checked_add(amount)
        .ok_or(StakingError::MathOverflow)?;
    stake_account.last_claim = current_timestamp;

    // Verify meets minimum tier threshold.
    require!(
        config.tier_for_amount(stake_account.amount).is_some(),
        StakingError::BelowMinimumStake
    );

    // Update global stats.
    let config = &mut ctx.accounts.config;
    config.total_staked = config
        .total_staked
        .checked_add(amount)
        .ok_or(StakingError::MathOverflow)?;
    if is_new_staker {
        config.active_stakers = config
            .active_stakers
            .checked_add(1)
            .ok_or(StakingError::MathOverflow)?;
    }

    let tier = config.tier_for_amount(stake_account.amount).unwrap_or(0);

    emit!(StakeEvent {
        user: ctx.accounts.user.key(),
        amount,
        total_staked: stake_account.amount,
        tier,
        timestamp: current_timestamp,
    });

    msg!(
        "Staked {} tokens. Total: {}. Tier: {}",
        amount,
        stake_account.amount,
        tier
    );

    Ok(())
}

/// Calculates linear rewards based on staked amount, duration, and APY.
///
/// Formula: `amount * apy_bps * duration_seconds / (10_000 * SECONDS_PER_YEAR)`
///
/// Uses checked arithmetic throughout to prevent overflow.
///
/// # Arguments
///
/// * `amount` - Staked token amount in base units.
/// * `last_claim` - Unix timestamp of the last claim.
/// * `current_timestamp` - Current on-chain clock timestamp.
/// * `apy_bps` - Annual percentage yield in basis points.
///
/// # Returns
///
/// The calculated reward amount in base token units.
///
/// # Errors
///
/// Returns [`StakingError::MathOverflow`] if any arithmetic operation overflows.
pub fn calculate_rewards(
    amount: u64,
    last_claim: i64,
    current_timestamp: i64,
    apy_bps: u16,
) -> Result<u64> {
    if amount == 0 || apy_bps == 0 || current_timestamp <= last_claim {
        return Ok(0);
    }

    let duration_seconds = current_timestamp
        .checked_sub(last_claim)
        .ok_or(StakingError::MathOverflow)? as u64;

    // Use u128 intermediates to prevent overflow:
    // reward = amount * apy_bps * duration / (10_000 * SECONDS_PER_YEAR)
    let amount_128 = amount as u128;
    let apy_128 = apy_bps as u128;
    let duration_128 = duration_seconds as u128;
    let seconds_per_year_128 = crate::state::SECONDS_PER_YEAR as u128;

    let numerator = amount_128
        .checked_mul(apy_128)
        .ok_or(StakingError::MathOverflow)?
        .checked_mul(duration_128)
        .ok_or(StakingError::MathOverflow)?;

    let denominator = 10_000u128
        .checked_mul(seconds_per_year_128)
        .ok_or(StakingError::MathOverflow)?;

    let reward = numerator
        .checked_div(denominator)
        .ok_or(StakingError::MathOverflow)?;

    // Safe truncation: reward should fit in u64 for practical stake amounts.
    u64::try_from(reward).map_err(|_| error!(StakingError::MathOverflow))
}

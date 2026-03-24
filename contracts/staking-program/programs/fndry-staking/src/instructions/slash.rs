//! Admin-only slash instruction.
//!
//! Allows the admin authority to reduce a user's staked balance as a
//! penalty for bad behavior. Slashed tokens are transferred from the
//! user's stake vault to the reward pool (recycled as future rewards).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingError;
use crate::events::SlashEvent;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `slash` instruction.
#[derive(Accounts)]
#[instruction(user_pubkey: Pubkey)]
pub struct Slash<'info> {
    /// The admin authority performing the slash.
    pub admin: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
        constraint = config.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub config: Account<'info, StakingConfig>,

    /// The target user's stake account PDA.
    #[account(
        mut,
        seeds = [b"stake", user_pubkey.as_ref()],
        bump = stake_account.bump,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// The target user's PDA-owned stake vault.
    #[account(
        mut,
        seeds = [b"stake_vault", user_pubkey.as_ref()],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// The reward pool vault that receives slashed tokens.
    #[account(
        mut,
        constraint = reward_pool_vault.key() == config.reward_pool_vault @ StakingError::Unauthorized,
    )]
    pub reward_pool_vault: Account<'info, TokenAccount>,

    /// Vault authority PDA.
    /// CHECK: PDA used as token account authority, validated by seeds.
    #[account(
        seeds = [b"vault_authority"],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,
}

/// Slashes a user's stake, transferring the penalty to the reward pool.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
/// * `user_pubkey` - The public key of the user being slashed (used for PDA derivation).
/// * `amount` - Amount of tokens to slash from the user's stake.
///
/// # Security
///
/// Only the admin authority recorded in the config PDA can call this.
/// The `admin` constraint on the config account enforces this check.
///
/// # Flow
///
/// 1. Validates the slash amount is valid (> 0, <= staked balance).
/// 2. Transfers slashed tokens from stake vault to reward pool.
/// 3. Reduces the user's staked balance.
/// 4. Updates global stats.
/// 5. Emits a [`SlashEvent`].
///
/// # Errors
///
/// - [`StakingError::Unauthorized`] if caller is not the admin.
/// - [`StakingError::ZeroSlashAmount`] if amount is 0.
/// - [`StakingError::SlashExceedsStake`] if amount > staked balance.
pub fn handler(ctx: Context<Slash>, user_pubkey: Pubkey, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::ZeroSlashAmount);

    let stake_account = &ctx.accounts.stake_account;
    require!(amount <= stake_account.amount, StakingError::SlashExceedsStake);

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    // Transfer slashed tokens from stake vault to reward pool via PDA signer.
    let vault_authority_bump = ctx.accounts.config.vault_authority_bump;
    let vault_authority_seeds: &[&[u8]] = &[b"vault_authority", &[vault_authority_bump]];
    let signer_seeds = &[vault_authority_seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.reward_pool_vault.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    // Update stake account.
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.amount = stake_account
        .amount
        .checked_sub(amount)
        .ok_or(StakingError::MathOverflow)?;

    // Update global stats.
    let config = &mut ctx.accounts.config;
    config.total_staked = config
        .total_staked
        .checked_sub(amount)
        .ok_or(StakingError::MathOverflow)?;

    if stake_account.amount == 0 {
        config.active_stakers = config.active_stakers.saturating_sub(1);
    }

    emit!(SlashEvent {
        admin: ctx.accounts.admin.key(),
        user: user_pubkey,
        slash_amount: amount,
        remaining_staked: stake_account.amount,
        timestamp: current_timestamp,
    });

    msg!(
        "Slashed {} tokens from user {}. Remaining: {}",
        amount,
        user_pubkey,
        stake_account.amount
    );

    Ok(())
}

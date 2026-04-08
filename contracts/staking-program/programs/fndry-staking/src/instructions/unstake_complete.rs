//! Complete the unstake after the cooldown period has elapsed.
//!
//! Transfers the cooldown amount from the PDA-owned stake vault back
//! to the user's token account. Decrements the global staking stats.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingError;
use crate::events::UnstakeCompletedEvent;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `unstake_complete` instruction.
#[derive(Accounts)]
pub struct UnstakeComplete<'info> {
    /// The user completing the unstake.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
    )]
    pub config: Box<Account<'info, StakingConfig>>,

    /// The user's stake account PDA.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    /// PDA-owned stake vault holding the user's staked tokens.
    #[account(
        mut,
        seeds = [b"stake_vault", user.key().as_ref()],
        bump,
    )]
    pub stake_vault: Box<Account<'info, TokenAccount>>,

    /// The user's token account to receive unstaked tokens.
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::Unauthorized,
        constraint = user_token_account.mint == config.token_mint @ StakingError::Unauthorized,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault authority PDA that controls the stake vault.
    /// CHECK: PDA used as token account authority, validated by seeds.
    #[account(
        seeds = [b"vault_authority"],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,
}

/// Completes the unstake after the 7-day cooldown has elapsed.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
///
/// # Flow
///
/// 1. Validates that a cooldown is active and has elapsed.
/// 2. Transfers the cooldown amount from the stake vault to the user.
/// 3. Reduces the staked balance and resets cooldown state.
/// 4. If the staked balance reaches 0, decrements active stakers.
/// 5. Emits an [`UnstakeCompletedEvent`].
///
/// # Errors
///
/// - [`StakingError::NoCooldownActive`] if no cooldown is in progress.
/// - [`StakingError::CooldownNotElapsed`] if the 7-day period hasn't passed.
pub fn handler(ctx: Context<UnstakeComplete>) -> Result<()> {
    let stake_account = &mut ctx.accounts.stake_account;
    let config = &ctx.accounts.config;

    require!(stake_account.cooldown_active, StakingError::NoCooldownActive);

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    require!(
        stake_account.cooldown_elapsed(current_timestamp, config.cooldown_seconds),
        StakingError::CooldownNotElapsed
    );

    let unstake_amount = stake_account.cooldown_amount;

    // Transfer tokens from vault back to user via PDA signer.
    let vault_authority_bump = config.vault_authority_bump;
    let vault_authority_seeds: &[&[u8]] = &[b"vault_authority", &[vault_authority_bump]];
    let signer_seeds = &[vault_authority_seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, unstake_amount)?;

    // Update stake account state.
    // NOTE: stake_account.amount was already decremented in unstake_initiate
    // to prevent rewards double-dipping.
    stake_account.cooldown_active = false;
    stake_account.cooldown_start = 0;
    stake_account.cooldown_amount = 0;
    stake_account.last_claim = current_timestamp;

    emit!(UnstakeCompletedEvent {
        user: ctx.accounts.user.key(),
        amount: unstake_amount,
        remaining_staked: stake_account.amount,
        timestamp: current_timestamp,
    });

    msg!(
        "Unstake completed: {} tokens returned. Remaining: {}",
        unstake_amount,
        stake_account.amount
    );

    Ok(())
}

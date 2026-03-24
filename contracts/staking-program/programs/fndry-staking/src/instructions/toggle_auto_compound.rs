//! Toggle the auto-compound flag on a user's stake account.
//!
//! When enabled, off-chain cranks or keepers can call the `compound`
//! instruction on behalf of the user at regular intervals. The on-chain
//! flag serves as the user's opt-in signal.

use anchor_lang::prelude::*;

use crate::errors::StakingError;
use crate::events::AutoCompoundToggleEvent;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `toggle_auto_compound` instruction.
#[derive(Accounts)]
pub struct ToggleAutoCompound<'info> {
    /// The user toggling their auto-compound preference.
    pub user: Signer<'info>,

    /// Global staking configuration PDA (read-only for pause check).
    #[account(
        seeds = [b"config"],
        bump = config.config_bump,
    )]
    pub config: Account<'info, StakingConfig>,

    /// The user's stake account PDA.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Account<'info, StakeAccount>,
}

/// Toggles the auto-compound flag on the user's stake account.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
/// * `enabled` - Whether to enable (`true`) or disable (`false`) auto-compound.
///
/// # Effects
///
/// Sets `stake_account.auto_compound` to the provided value and emits
/// an [`AutoCompoundToggleEvent`].
///
/// # Errors
///
/// - [`StakingError::ProgramPaused`] if the program is paused.
pub fn handler(ctx: Context<ToggleAutoCompound>, enabled: bool) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, StakingError::ProgramPaused);

    let clock = Clock::get()?;
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.auto_compound = enabled;

    emit!(AutoCompoundToggleEvent {
        user: ctx.accounts.user.key(),
        enabled,
        timestamp: clock.unix_timestamp,
    });

    msg!("Auto-compound set to: {}", enabled);

    Ok(())
}

//! Handler for the `close_bounty` instruction.
//!
//! Cancels a bounty that is in `Open` or `Claimed` status. Once
//! cancelled, the bounty becomes terminal and no further mutations
//! are allowed.

use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::BountyClosed;
use crate::state::*;

/// Accounts required by the [`close_bounty`] instruction.
///
/// The `admin` signer must match the bounty creator. The `bounty_record`
/// PDA must not be in a terminal state.
#[derive(Accounts)]
pub struct CloseBounty<'info> {
    /// The admin authority closing (cancelling) the bounty.
    /// Must match the `creator` field on the bounty record.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The bounty record PDA to cancel.
    /// Constraint: signer must be the original creator (authority check).
    #[account(
        mut,
        seeds = [REGISTRY_SEED, &bounty_record.bounty_id.to_le_bytes()],
        bump = bounty_record.bump,
        constraint = bounty_record.creator == admin.key() @ RegistryError::Unauthorized
    )]
    pub bounty_record: Account<'info, BountyRecord>,
}

/// Handle the `close_bounty` instruction.
///
/// Validates that the bounty is not already in a terminal state,
/// transitions it to `Cancelled`, updates the timestamp, and emits
/// a [`BountyClosed`] event.
///
/// # Arguments
///
/// * `ctx` – Validated accounts context.
///
/// # Errors
///
/// * [`RegistryError::BountyAlreadyClosed`] – bounty is already Completed or Cancelled.
pub fn handler(ctx: Context<CloseBounty>) -> Result<()> {
    let record = &mut ctx.accounts.bounty_record;

    // Reject if already terminal.
    require!(!record.status.is_terminal(), RegistryError::BountyAlreadyClosed);

    // Close (cancel) is only permitted from Open or Claimed, not InReview.
    require!(
        record.status == BountyStatus::Open || record.status == BountyStatus::Claimed,
        RegistryError::InvalidStatusTransition
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let previous_status = record.status as u8;

    // Transition to cancelled.
    record.status = BountyStatus::Cancelled;
    record.updated_at = now;

    // Emit closure event for indexers.
    emit!(BountyClosed {
        bounty_id: record.bounty_id,
        previous_status,
        closed_at: now,
    });

    msg!("Bounty {} closed (cancelled)", record.bounty_id);
    Ok(())
}

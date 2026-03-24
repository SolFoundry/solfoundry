//! Handler for the `update_status` instruction.
//!
//! Transitions a bounty to a new lifecycle status, enforcing the
//! state machine rules. Sets the contributor when claiming.

use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::BountyStatusUpdated;
use crate::state::*;

/// Accounts required by the [`update_status`] instruction.
///
/// The `admin` signer must match the original bounty creator (authority check).
/// The `bounty_record` PDA is mutated to update its status.
#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    /// The admin authority performing the status update.
    /// Must match the `creator` field on the bounty record.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The bounty record PDA to update.
    /// Constraint: the signer must be the original creator (authority check).
    #[account(
        mut,
        seeds = [REGISTRY_SEED, &bounty_record.bounty_id.to_le_bytes()],
        bump = bounty_record.bump,
        constraint = bounty_record.creator == admin.key() @ RegistryError::Unauthorized
    )]
    pub bounty_record: Account<'info, BountyRecord>,
}

/// Handle the `update_status` instruction.
///
/// Parses the raw status value, validates the transition against the
/// state machine, optionally sets the contributor for claims, updates
/// the timestamp, and emits a [`BountyStatusUpdated`] event.
///
/// # Arguments
///
/// * `ctx` – Validated accounts context.
/// * `new_status` – Raw u8 status value (0–4).
/// * `contributor` – Optional contributor pubkey, required for Claimed transition.
///
/// # Errors
///
/// * [`RegistryError::BountyAlreadyClosed`] – bounty is in a terminal state.
/// * [`RegistryError::InvalidStatusValue`] – raw value is not 0–4.
/// * [`RegistryError::InvalidStatusTransition`] – transition not in state machine.
/// * [`RegistryError::ContributorRequiredForClaim`] – claiming without contributor.
pub fn handler(
    ctx: Context<UpdateStatus>,
    new_status: u8,
    contributor: Option<Pubkey>,
) -> Result<()> {
    let record = &mut ctx.accounts.bounty_record;

    // Reject mutations on terminal states.
    require!(!record.status.is_terminal(), RegistryError::BountyAlreadyClosed);

    // Parse and validate the target status.
    let target_status = BountyStatus::from_u8(new_status)
        .ok_or(error!(RegistryError::InvalidStatusValue))?;

    // Enforce state machine transitions.
    require!(
        record.status.can_transition_to(&target_status),
        RegistryError::InvalidStatusTransition
    );

    // Require contributor when claiming.
    if target_status == BountyStatus::Claimed {
        require!(
            contributor.is_some(),
            RegistryError::ContributorRequiredForClaim
        );
    }

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let previous_status = record.status as u8;

    // Apply the transition.
    record.status = target_status;
    record.updated_at = now;

    // Set contributor on claim.
    if target_status == BountyStatus::Claimed {
        record.contributor = contributor;
    }

    // Emit status change event for indexers.
    emit!(BountyStatusUpdated {
        bounty_id: record.bounty_id,
        previous_status,
        new_status,
        contributor: record.contributor,
        updated_at: now,
    });

    msg!(
        "Bounty {} status updated: {} -> {}",
        record.bounty_id,
        previous_status,
        new_status
    );
    Ok(())
}

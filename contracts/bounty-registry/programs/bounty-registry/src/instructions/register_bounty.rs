//! Handler for the `register_bounty` instruction.
//!
//! Creates a new PDA account for a bounty record and initialises
//! all metadata fields. The bounty starts in `Open` status.

use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::BountyRegistered;
use crate::state::*;

/// Accounts required by the [`register_bounty`] instruction.
///
/// The `bounty_record` PDA is derived from `["registry", bounty_id.to_le_bytes()]`
/// and is initialised by this instruction. The `admin` signer pays for
/// account rent and is recorded as the bounty creator.
#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct RegisterBounty<'info> {
    /// The admin authority who is registering the bounty.
    /// Must be a signer; pays for PDA account rent.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The bounty record PDA to be created.
    /// Seeds: `["registry", bounty_id.to_le_bytes()]`.
    #[account(
        init,
        payer = admin,
        space = 8 + BountyRecord::INIT_SPACE,
        seeds = [REGISTRY_SEED, &bounty_id.to_le_bytes()],
        bump
    )]
    pub bounty_record: Account<'info, BountyRecord>,

    /// The Solana system program, required for PDA account creation.
    pub system_program: Program<'info, System>,
}

/// Handle the `register_bounty` instruction.
///
/// Validates input constraints (title length, tier range, github reference
/// length), initialises the PDA with provided metadata, and emits a
/// [`BountyRegistered`] event.
///
/// # Arguments
///
/// * `ctx` – Validated accounts context.
/// * `bounty_id` – Unique numeric bounty identifier.
/// * `title` – Bounty title (max 64 bytes).
/// * `tier` – Bounty tier (1, 2, or 3).
/// * `reward_amount` – Reward amount in smallest token unit.
/// * `github_issue` – GitHub issue reference (max 128 bytes).
///
/// # Errors
///
/// * [`RegistryError::TitleTooLong`] – title exceeds 64 bytes.
/// * [`RegistryError::InvalidTier`] – tier is not 1, 2, or 3.
/// * [`RegistryError::GithubReferenceTooLong`] – github_issue exceeds 128 bytes.
pub fn handler(
    ctx: Context<RegisterBounty>,
    bounty_id: u64,
    title: String,
    tier: u8,
    reward_amount: u64,
    github_issue: String,
) -> Result<()> {
    // Validate title length.
    require!(title.len() <= MAX_TITLE_LENGTH, RegistryError::TitleTooLong);

    // Validate tier is within the allowed range.
    require!(tier >= 1 && tier <= 3, RegistryError::InvalidTier);

    // Validate GitHub issue reference length.
    require!(
        github_issue.len() <= MAX_GITHUB_REF_LENGTH,
        RegistryError::GithubReferenceTooLong
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    let record = &mut ctx.accounts.bounty_record;
    record.bounty_id = bounty_id;
    record.title = title.clone();
    record.tier = tier;
    record.reward_amount = reward_amount;
    record.status = BountyStatus::Open;
    record.creator = ctx.accounts.admin.key();
    record.contributor = None;
    record.github_issue = github_issue.clone();
    record.github_pr = String::new();
    record.review_scores = Vec::new();
    record.final_score = 0;
    record.pr_hash = None;
    record.created_at = now;
    record.updated_at = now;
    record.completed_at = None;
    record.bump = ctx.bumps.bounty_record;

    // Emit registration event for indexers.
    emit!(BountyRegistered {
        bounty_id,
        title,
        tier,
        reward_amount,
        github_issue,
        creator: ctx.accounts.admin.key(),
        created_at: now,
    });

    msg!("Bounty {} registered successfully", bounty_id);
    Ok(())
}

//! Handler for the `record_completion` instruction.
//!
//! Records the full review pipeline results — PR reference, five
//! individual model scores, the aggregated final score, and a SHA-256
//! hash of the merged PR diff — then transitions the bounty to Completed.

use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::BountyCompleted;
use crate::state::*;

/// Accounts required by the [`record_completion`] instruction.
///
/// The `admin` signer must match the bounty creator. The `bounty_record`
/// PDA must be in `InReview` status.
#[derive(Accounts)]
pub struct RecordCompletion<'info> {
    /// The admin authority recording the completion.
    /// Must match the `creator` field on the bounty record.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The bounty record PDA to update with completion data.
    /// Constraint: signer must be the original creator (authority check).
    #[account(
        mut,
        seeds = [REGISTRY_SEED, &bounty_record.bounty_id.to_le_bytes()],
        bump = bounty_record.bump,
        constraint = bounty_record.creator == admin.key() @ RegistryError::Unauthorized
    )]
    pub bounty_record: Account<'info, BountyRecord>,
}

/// Handle the `record_completion` instruction.
///
/// Validates that the bounty is in `InReview` status, checks score
/// constraints (exactly 5 scores, each 0–1000), stores all completion
/// data, transitions to `Completed`, and emits a [`BountyCompleted`] event.
///
/// # Arguments
///
/// * `ctx` – Validated accounts context.
/// * `github_pr` – GitHub PR URL or number string (max 128 bytes).
/// * `review_scores` – Exactly five u16 scores (0–1000 each).
/// * `final_score` – Aggregated final score (0–1000).
/// * `pr_hash` – SHA-256 hash of the merged PR diff (32 bytes).
///
/// # Errors
///
/// * [`RegistryError::InvalidStatusForCompletion`] – not in InReview.
/// * [`RegistryError::GithubReferenceTooLong`] – PR reference too long.
/// * [`RegistryError::InvalidScoreCount`] – not exactly 5 scores.
/// * [`RegistryError::ScoreOutOfRange`] – any score exceeds 1000.
pub fn handler(
    ctx: Context<RecordCompletion>,
    github_pr: String,
    review_scores: Vec<u16>,
    final_score: u16,
    pr_hash: [u8; 32],
) -> Result<()> {
    let record = &mut ctx.accounts.bounty_record;

    // Must be in InReview to record completion.
    require!(
        record.status == BountyStatus::InReview,
        RegistryError::InvalidStatusForCompletion
    );

    // Validate GitHub PR reference length.
    require!(
        github_pr.len() <= MAX_GITHUB_REF_LENGTH,
        RegistryError::GithubReferenceTooLong
    );

    // Validate exactly 5 review scores.
    require!(
        review_scores.len() == REVIEW_MODEL_COUNT,
        RegistryError::InvalidScoreCount
    );

    // Validate each score is within range (0–1000, representing 0.0–10.0).
    for score in &review_scores {
        require!(*score <= 1000, RegistryError::ScoreOutOfRange);
    }

    // Validate final score is within range.
    require!(final_score <= 1000, RegistryError::ScoreOutOfRange);

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Store completion data.
    record.github_pr = github_pr.clone();
    record.review_scores = review_scores.clone();
    record.final_score = final_score;
    record.pr_hash = Some(pr_hash);
    record.status = BountyStatus::Completed;
    record.completed_at = Some(now);
    record.updated_at = now;

    // Emit completion event for indexers.
    emit!(BountyCompleted {
        bounty_id: record.bounty_id,
        github_pr,
        review_scores,
        final_score,
        pr_hash,
        contributor: record.contributor,
        completed_at: now,
    });

    msg!("Bounty {} completion recorded", record.bounty_id);
    Ok(())
}

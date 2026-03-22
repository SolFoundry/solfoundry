//! # Bounty Registry Program
//!
//! An on-chain registry that records bounty metadata on Solana for
//! [SolFoundry](https://github.com/SolFoundry/solfoundry). This program does
//! **not** handle funds — it stores bounty definitions, statuses, and
//! completion records as immutable on-chain data for transparency and
//! verification.
//!
//! ## Design Principles
//!
//! - **Read-only registry**: No token accounts or fund custody. Metadata only.
//! - **Authority-gated writes**: Only the designated admin can mutate state.
//! - **PDA derivation**: `["registry", bounty_id]` per bounty record.
//! - **Event emission**: Every state change emits a CPI event for indexers.
//! - **Overflow-safe math**: All arithmetic uses checked operations.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe");

/// The bounty registry program module.
///
/// Provides four instructions for managing on-chain bounty records:
/// `register_bounty`, `update_status`, `record_completion`, and `close_bounty`.
#[program]
pub mod bounty_registry {
    use super::*;

    /// Register a new bounty in the on-chain registry.
    ///
    /// Creates a PDA account derived from `["registry", bounty_id]` and
    /// initialises all metadata fields. The bounty starts in `Open` status.
    ///
    /// # Arguments
    ///
    /// * `ctx` – Accounts context containing the admin signer and new bounty PDA.
    /// * `bounty_id` – Unique numeric identifier for the bounty.
    /// * `title` – Human-readable bounty title (max 64 characters).
    /// * `tier` – Bounty tier (1, 2, or 3).
    /// * `reward_amount` – Reward in lamports / smallest token unit (metadata only).
    /// * `github_issue` – GitHub issue URL or number string (max 128 characters).
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::TitleTooLong`] if `title` exceeds 64 bytes.
    /// Returns [`RegistryError::InvalidTier`] if `tier` is not 1, 2, or 3.
    /// Returns [`RegistryError::GithubReferenceTooLong`] if `github_issue` exceeds 128 bytes.
    pub fn register_bounty(
        ctx: Context<RegisterBounty>,
        bounty_id: u64,
        title: String,
        tier: u8,
        reward_amount: u64,
        github_issue: String,
    ) -> Result<()> {
        instructions::register_bounty::handler(ctx, bounty_id, title, tier, reward_amount, github_issue)
    }

    /// Transition the bounty to a new status.
    ///
    /// Enforces the state machine: Open → Claimed → InReview → Completed | Cancelled.
    /// Cancelled is reachable from Open or Claimed. Sets the contributor pubkey
    /// when transitioning to Claimed.
    ///
    /// # Arguments
    ///
    /// * `ctx` – Accounts context containing the admin signer and bounty PDA.
    /// * `new_status` – Target status value (0=Open, 1=Claimed, 2=InReview, 3=Completed, 4=Cancelled).
    /// * `contributor` – Optional contributor pubkey, required when moving to Claimed.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::InvalidStatusTransition`] for disallowed transitions.
    /// Returns [`RegistryError::ContributorRequiredForClaim`] when claiming without a contributor.
    /// Returns [`RegistryError::BountyAlreadyClosed`] if the bounty is Completed or Cancelled.
    pub fn update_status(
        ctx: Context<UpdateStatus>,
        new_status: u8,
        contributor: Option<Pubkey>,
    ) -> Result<()> {
        instructions::update_status::handler(ctx, new_status, contributor)
    }

    /// Record completion details for a bounty that has been reviewed.
    ///
    /// Stores the PR reference, individual review scores from all five
    /// review models, and the final aggregated verdict. The bounty must be
    /// in `InReview` status and transitions to `Completed`.
    ///
    /// # Arguments
    ///
    /// * `ctx` – Accounts context containing the admin signer and bounty PDA.
    /// * `github_pr` – GitHub PR URL or number string (max 128 characters).
    /// * `review_scores` – Array of five u16 scores (0–1000, representing 0.0–10.0).
    /// * `final_score` – Aggregated final score (0–1000).
    /// * `pr_hash` – SHA-256 hash of the merged PR diff (32 bytes).
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::InvalidStatusForCompletion`] if not in InReview.
    /// Returns [`RegistryError::InvalidScoreCount`] if scores array length != 5.
    /// Returns [`RegistryError::ScoreOutOfRange`] if any score > 1000.
    /// Returns [`RegistryError::GithubReferenceTooLong`] if `github_pr` exceeds 128 bytes.
    pub fn record_completion(
        ctx: Context<RecordCompletion>,
        github_pr: String,
        review_scores: Vec<u16>,
        final_score: u16,
        pr_hash: [u8; 32],
    ) -> Result<()> {
        instructions::record_completion::handler(ctx, github_pr, review_scores, final_score, pr_hash)
    }

    /// Close the bounty by cancelling it.
    ///
    /// Transitions the bounty to `Cancelled` status. Only permitted from
    /// `Open` or `Claimed` states. Once cancelled, no further mutations
    /// are allowed.
    ///
    /// # Arguments
    ///
    /// * `ctx` – Accounts context containing the admin signer and bounty PDA.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::BountyAlreadyClosed`] if already Completed or Cancelled.
    pub fn close_bounty(ctx: Context<CloseBounty>) -> Result<()> {
        instructions::close_bounty::handler(ctx)
    }
}

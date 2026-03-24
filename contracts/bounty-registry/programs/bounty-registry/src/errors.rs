//! Custom error codes for the bounty registry program.
//!
//! Each variant maps to a specific validation or business rule violation.
//! Error codes start at 6000 (Anchor convention for custom errors).

use anchor_lang::prelude::*;

/// Custom error codes for the bounty registry program.
///
/// These errors cover input validation, state machine enforcement,
/// and authority checks. Each variant includes a descriptive message
/// for client-side error handling.
#[error_code]
pub enum RegistryError {
    /// The provided title exceeds the maximum allowed length of 64 bytes.
    #[msg("Title exceeds maximum length of 64 characters")]
    TitleTooLong,

    /// The provided tier value is not 1, 2, or 3.
    #[msg("Invalid tier: must be 1, 2, or 3")]
    InvalidTier,

    /// A GitHub reference (issue or PR URL) exceeds the maximum of 128 bytes.
    #[msg("GitHub reference exceeds maximum length of 128 characters")]
    GithubReferenceTooLong,

    /// The requested status transition is not permitted by the state machine.
    ///
    /// Valid transitions: Open→Claimed, Open→Cancelled, Claimed→InReview,
    /// Claimed→Cancelled, InReview→Completed.
    #[msg("Invalid status transition")]
    InvalidStatusTransition,

    /// A contributor pubkey must be provided when transitioning to Claimed.
    #[msg("Contributor public key is required when claiming a bounty")]
    ContributorRequiredForClaim,

    /// The bounty is already in a terminal state (Completed or Cancelled).
    #[msg("Bounty is already closed (completed or cancelled)")]
    BountyAlreadyClosed,

    /// The raw status value does not map to a valid BountyStatus variant.
    #[msg("Invalid status value: must be 0-4")]
    InvalidStatusValue,

    /// record_completion requires the bounty to be in InReview status.
    #[msg("Bounty must be in InReview status to record completion")]
    InvalidStatusForCompletion,

    /// Exactly five review scores must be provided (one per LLM model).
    #[msg("Exactly 5 review scores are required (one per model)")]
    InvalidScoreCount,

    /// A review score exceeds the maximum value of 1000 (representing 10.0).
    #[msg("Review score out of range: must be 0-1000")]
    ScoreOutOfRange,

    /// An arithmetic operation would overflow.
    #[msg("Arithmetic overflow detected")]
    ArithmeticOverflow,

    /// The signer is not the authorised admin for this operation.
    #[msg("Unauthorized: signer is not the registry admin")]
    Unauthorized,
}

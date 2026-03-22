//! Instruction handlers for the bounty registry program.
//!
//! Each sub-module implements one program instruction with its own
//! account validation struct and handler function.

pub mod close_bounty;
pub mod record_completion;
pub mod register_bounty;
pub mod update_status;

pub use close_bounty::*;
pub use record_completion::*;
pub use register_bounty::*;
pub use update_status::*;

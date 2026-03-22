use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;

declare_id!("BounTyReg1stryXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─── Program ──────────────────────────────────────────────────────────────────

#[program]
pub mod bounty_registry {
    use super::*;

    /// Initialize the global registry singleton.
    /// Can only be called once by the protocol authority.
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        params: InitRegistryParams,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.treasury = params.treasury;
        registry.fndry_mint = params.fndry_mint;
        registry.total_bounties = 0;
        registry.total_completed = 0;
        registry.total_paid_out = 0;
        registry.slash_basis_points = params.slash_basis_points;
        registry.bump = ctx.bumps.registry;

        emit!(RegistryInitialized {
            authority: registry.authority,
            treasury: registry.treasury,
            fndry_mint: registry.fndry_mint,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Register a new bounty on-chain, tied to a GitHub issue.
    pub fn register_bounty(
        ctx: Context<RegisterBounty>,
        params: RegisterBountyParams,
    ) -> Result<()> {
        require!(
            params.reward_amount > 0,
            RegistryError::InvalidRewardAmount
        );
        require!(
            params.title.len() > 0 && params.title.len() <= 128,
            RegistryError::InvalidTitle
        );
        require!(
            params.tier >= 1 && params.tier <= 3,
            RegistryError::InvalidTier
        );

        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.bounty_entry;

        entry.id = registry.total_bounties;
        entry.registry = registry.key();
        entry.creator = ctx.accounts.authority.key();
        entry.title = params.title.clone();
        entry.issue_number = params.issue_number;
        entry.reward_amount = params.reward_amount;
        entry.tier = params.tier;
        entry.status = BountyStatus::Open;
        entry.assignee = None;
        entry.metadata_uri = params.metadata_uri.clone();
        entry.created_at = Clock::get()?.unix_timestamp;
        entry.updated_at = entry.created_at;
        entry.completed_at = None;
        entry.bump = ctx.bumps.bounty_entry;

        registry.total_bounties = registry
            .total_bounties
            .checked_add(1)
            .ok_or(RegistryError::Overflow)?;

        emit!(BountyRegistered {
            bounty_id: entry.id,
            creator: entry.creator,
            issue_number: entry.issue_number,
            reward_amount: entry.reward_amount,
            tier: entry.tier,
            timestamp: entry.created_at,
        });

        Ok(())
    }

    /// Mark a bounty as completed and record the winning contributor.
    /// The authority must sign; actual token transfer happens off-chain or
    /// via a separate payout instruction.
    pub fn complete_bounty(
        ctx: Context<CompleteBounty>,
        contributor_address: Pubkey,
        pr_url: String,
    ) -> Result<()> {
        require!(pr_url.len() <= 256, RegistryError::InvalidMetadataUri);

        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.bounty_entry;
        let contributor = &mut ctx.accounts.contributor_record;

        require!(
            entry.status == BountyStatus::Open || entry.status == BountyStatus::InProgress,
            RegistryError::BountyNotOpenOrInProgress
        );

        let now = Clock::get()?.unix_timestamp;
        entry.status = BountyStatus::Completed;
        entry.assignee = Some(contributor_address);
        entry.completed_at = Some(now);
        entry.updated_at = now;
        entry.pr_url = Some(pr_url.clone());

        contributor.bounties_completed = contributor
            .bounties_completed
            .checked_add(1)
            .ok_or(RegistryError::Overflow)?;
        contributor.total_earned = contributor
            .total_earned
            .checked_add(entry.reward_amount)
            .ok_or(RegistryError::Overflow)?;
        contributor.reputation_score = (contributor.reputation_score + 10).min(1000);
        contributor.last_activity = now;

        registry.total_completed = registry
            .total_completed
            .checked_add(1)
            .ok_or(RegistryError::Overflow)?;
        registry.total_paid_out = registry
            .total_paid_out
            .checked_add(entry.reward_amount)
            .ok_or(RegistryError::Overflow)?;

        emit!(BountyCompleted {
            bounty_id: entry.id,
            contributor: contributor_address,
            reward_amount: entry.reward_amount,
            pr_url,
            timestamp: now,
        });

        Ok(())
    }

    /// Slash a contributor's reputation for violating contribution rules.
    /// Reduces reputation_score by a proportional amount based on slash_basis_points.
    pub fn slash_contributor(
        ctx: Context<SlashContributor>,
        reason: String,
    ) -> Result<()> {
        require!(reason.len() > 0 && reason.len() <= 256, RegistryError::InvalidReason);

        let registry = &ctx.accounts.registry;
        let contributor = &mut ctx.accounts.contributor_record;

        let slash_amount = (contributor.reputation_score as u64)
            .checked_mul(registry.slash_basis_points as u64)
            .ok_or(RegistryError::Overflow)?
            .checked_div(10_000)
            .ok_or(RegistryError::Overflow)? as u32;

        let prev_score = contributor.reputation_score;
        contributor.reputation_score = contributor.reputation_score.saturating_sub(slash_amount);
        contributor.slash_count = contributor
            .slash_count
            .checked_add(1)
            .ok_or(RegistryError::Overflow)?;
        contributor.last_activity = Clock::get()?.unix_timestamp;

        emit!(ContributorSlashed {
            contributor: contributor.address,
            prev_reputation: prev_score,
            new_reputation: contributor.reputation_score,
            slash_count: contributor.slash_count,
            reason,
            authority: ctx.accounts.authority.key(),
            timestamp: contributor.last_activity,
        });

        Ok(())
    }

    /// Update the metadata URI of an existing bounty (e.g., to point to a new spec version).
    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        new_metadata_uri: String,
        new_title: Option<String>,
    ) -> Result<()> {
        require!(
            new_metadata_uri.len() > 0 && new_metadata_uri.len() <= 256,
            RegistryError::InvalidMetadataUri
        );

        let entry = &mut ctx.accounts.bounty_entry;

        require!(
            entry.status != BountyStatus::Completed && entry.status != BountyStatus::Closed,
            RegistryError::BountyAlreadyFinalised
        );

        let old_uri = entry.metadata_uri.clone();
        entry.metadata_uri = new_metadata_uri.clone();

        if let Some(title) = new_title {
            require!(title.len() > 0 && title.len() <= 128, RegistryError::InvalidTitle);
            entry.title = title;
        }

        entry.updated_at = Clock::get()?.unix_timestamp;

        emit!(BountyMetadataUpdated {
            bounty_id: entry.id,
            old_uri,
            new_uri: new_metadata_uri,
            updater: ctx.accounts.authority.key(),
            timestamp: entry.updated_at,
        });

        Ok(())
    }

    /// Register a new contributor (or re-activate a banned one via admin).
    pub fn register_contributor(
        ctx: Context<RegisterContributor>,
        github_handle: String,
    ) -> Result<()> {
        require!(
            github_handle.len() > 0 && github_handle.len() <= 64,
            RegistryError::InvalidGithubHandle
        );

        let contributor = &mut ctx.accounts.contributor_record;
        let now = Clock::get()?.unix_timestamp;

        contributor.address = ctx.accounts.contributor_wallet.key();
        contributor.registry = ctx.accounts.registry.key();
        contributor.github_handle = github_handle.clone();
        contributor.reputation_score = 100; // starting score
        contributor.bounties_completed = 0;
        contributor.total_earned = 0;
        contributor.slash_count = 0;
        contributor.is_banned = false;
        contributor.joined_at = now;
        contributor.last_activity = now;
        contributor.bump = ctx.bumps.contributor_record;

        emit!(ContributorRegistered {
            contributor: contributor.address,
            github_handle,
            timestamp: now,
        });

        Ok(())
    }
}

// ─── State structs ────────────────────────────────────────────────────────────

/// Global registry singleton — one per deployment.
#[account]
#[derive(Default)]
pub struct Registry {
    /// The protocol authority (multisig or admin wallet)
    pub authority: Pubkey,           // 32
    /// Treasury wallet that holds $FNDRY reserves
    pub treasury: Pubkey,            // 32
    /// $FNDRY SPL token mint address
    pub fndry_mint: Pubkey,          // 32
    /// Running count of all registered bounties
    pub total_bounties: u64,         // 8
    /// Running count of completed bounties
    pub total_completed: u64,        // 8
    /// Cumulative $FNDRY paid out (in lamports/smallest unit)
    pub total_paid_out: u64,         // 8
    /// Slash percentage in basis points (e.g. 500 = 5%)
    pub slash_basis_points: u16,     // 2
    /// PDA bump
    pub bump: u8,                    // 1
}

impl Registry {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 2 + 1 + 64; // +64 padding
}

/// On-chain record for a single bounty.
#[account]
pub struct BountyEntry {
    pub id: u64,                      // 8
    pub registry: Pubkey,             // 32
    pub creator: Pubkey,              // 32
    pub title: String,                // 4 + 128
    pub issue_number: u64,            // 8
    pub reward_amount: u64,           // 8  (in $FNDRY base units)
    pub tier: u8,                     // 1  (1 | 2 | 3)
    pub status: BountyStatus,         // 1
    pub assignee: Option<Pubkey>,     // 1 + 32
    pub metadata_uri: String,         // 4 + 256
    pub pr_url: Option<String>,       // 1 + 4 + 256
    pub created_at: i64,              // 8
    pub updated_at: i64,              // 8
    pub completed_at: Option<i64>,    // 1 + 8
    pub bump: u8,                     // 1
}

impl BountyEntry {
    pub const LEN: usize = 8 + 8 + 32 + 32 + (4 + 128) + 8 + 8 + 1 + 1 + (1 + 32)
        + (4 + 256) + (1 + 4 + 256) + 8 + 8 + (1 + 8) + 1 + 64;
}

/// Per-contributor on-chain record (one PDA per wallet).
#[account]
pub struct ContributorRecord {
    pub address: Pubkey,              // 32
    pub registry: Pubkey,             // 32
    pub github_handle: String,        // 4 + 64
    pub reputation_score: u32,        // 4
    pub bounties_completed: u32,      // 4
    pub total_earned: u64,            // 8
    pub slash_count: u16,             // 2
    pub is_banned: bool,              // 1
    pub joined_at: i64,               // 8
    pub last_activity: i64,           // 8
    pub bump: u8,                     // 1
}

impl ContributorRecord {
    pub const LEN: usize = 8 + 32 + 32 + (4 + 64) + 4 + 4 + 8 + 2 + 1 + 8 + 8 + 1 + 32;
}

// ─── Enums ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum BountyStatus {
    #[default]
    Open,
    InProgress,
    Review,
    Completed,
    Closed,
}

// ─── Instruction params ───────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitRegistryParams {
    pub treasury: Pubkey,
    pub fndry_mint: Pubkey,
    pub slash_basis_points: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RegisterBountyParams {
    pub title: String,
    pub issue_number: u64,
    pub reward_amount: u64,
    pub tier: u8,
    pub metadata_uri: String,
}

// ─── Accounts contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = Registry::LEN,
        seeds = [b"registry"],
        bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: RegisterBountyParams)]
pub struct RegisterBounty<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = authority @ RegistryError::Unauthorized,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        init,
        payer = authority,
        space = BountyEntry::LEN,
        seeds = [b"bounty", registry.total_bounties.to_le_bytes().as_ref()],
        bump,
    )]
    pub bounty_entry: Account<'info, BountyEntry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteBounty<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = authority @ RegistryError::Unauthorized,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        mut,
        seeds = [b"bounty", bounty_entry.id.to_le_bytes().as_ref()],
        bump = bounty_entry.bump,
    )]
    pub bounty_entry: Account<'info, BountyEntry>,

    #[account(
        mut,
        seeds = [b"contributor", contributor_record.address.as_ref()],
        bump = contributor_record.bump,
    )]
    pub contributor_record: Account<'info, ContributorRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashContributor<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = authority @ RegistryError::Unauthorized,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        mut,
        seeds = [b"contributor", contributor_record.address.as_ref()],
        bump = contributor_record.bump,
    )]
    pub contributor_record: Account<'info, ContributorRecord>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = authority @ RegistryError::Unauthorized,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        mut,
        seeds = [b"bounty", bounty_entry.id.to_le_bytes().as_ref()],
        bump = bounty_entry.bump,
    )]
    pub bounty_entry: Account<'info, BountyEntry>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterContributor<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        init,
        payer = contributor_wallet,
        space = ContributorRecord::LEN,
        seeds = [b"contributor", contributor_wallet.key().as_ref()],
        bump,
    )]
    pub contributor_record: Account<'info, ContributorRecord>,

    #[account(mut)]
    pub contributor_wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct RegistryInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fndry_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BountyRegistered {
    pub bounty_id: u64,
    pub creator: Pubkey,
    pub issue_number: u64,
    pub reward_amount: u64,
    pub tier: u8,
    pub timestamp: i64,
}

#[event]
pub struct BountyCompleted {
    pub bounty_id: u64,
    pub contributor: Pubkey,
    pub reward_amount: u64,
    pub pr_url: String,
    pub timestamp: i64,
}

#[event]
pub struct BountyMetadataUpdated {
    pub bounty_id: u64,
    pub old_uri: String,
    pub new_uri: String,
    pub updater: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ContributorRegistered {
    pub contributor: Pubkey,
    pub github_handle: String,
    pub timestamp: i64,
}

#[event]
pub struct ContributorSlashed {
    pub contributor: Pubkey,
    pub prev_reputation: u32,
    pub new_reputation: u32,
    pub slash_count: u16,
    pub reason: String,
    pub authority: Pubkey,
    pub timestamp: i64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum RegistryError {
    #[msg("Caller is not the registry authority")]
    Unauthorized,
    #[msg("Reward amount must be greater than zero")]
    InvalidRewardAmount,
    #[msg("Title must be 1–128 characters")]
    InvalidTitle,
    #[msg("Tier must be 1, 2, or 3")]
    InvalidTier,
    #[msg("Metadata URI must be 1–256 characters")]
    InvalidMetadataUri,
    #[msg("Bounty is not open or in progress")]
    BountyNotOpenOrInProgress,
    #[msg("Bounty has already been finalised (completed or closed)")]
    BountyAlreadyFinalised,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Slash reason must be 1–256 characters")]
    InvalidReason,
    #[msg("GitHub handle must be 1–64 characters")]
    InvalidGithubHandle,
}

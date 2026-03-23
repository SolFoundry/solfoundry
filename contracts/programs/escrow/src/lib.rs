use anchor_lang::prelude::*;

// Placeholder ID — run `anchor build && anchor keys sync` to regenerate from keypair.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow {
    use super::*;

    /// Creates a new escrow PDA for the given authority.
    /// Locks bounty funds until release conditions are met.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.escrow_account;
        account.authority = ctx.accounts.authority.key();
        account.bump = ctx.bumps.escrow_account;
        account.amount = 0;
        account.is_active = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", authority.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    /// The wallet that controls this escrow.
    pub authority: Pubkey,
    /// Lamports currently locked in escrow.
    pub amount: u64,
    /// Whether a bounty payout is in progress.
    pub is_active: bool,
    /// PDA bump seed.
    pub bump: u8,
}

impl EscrowAccount {
    // discriminator(8) + pubkey(32) + u64(8) + bool(1) + u8(1)
    const LEN: usize = 8 + 32 + 8 + 1 + 1;
}

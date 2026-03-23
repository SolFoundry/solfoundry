use anchor_lang::prelude::*;

// Placeholder ID — run `anchor build && anchor keys sync` to regenerate from keypair.
declare_id!("TRSRy3jy5nK6tMxpPjzKpWkMN1AXyTWPz1yXD1yGxbj");

#[program]
pub mod treasury {
    use super::*;

    /// Initializes the protocol treasury PDA.
    /// Holds $FNDRY bounty budget and tracks buyback metrics.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.treasury_account;
        account.authority = ctx.accounts.authority.key();
        account.bump = ctx.bumps.treasury_account;
        account.total_paid_out = 0;
        account.total_bought_back = 0;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = TreasuryAccount::LEN,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury_account: Account<'info, TreasuryAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct TreasuryAccount {
    /// Protocol authority (multisig in production).
    pub authority: Pubkey,
    /// Cumulative $FNDRY paid out as bounty rewards (in lamports).
    pub total_paid_out: u64,
    /// Cumulative $FNDRY bought back via the 5% fee mechanism.
    pub total_bought_back: u64,
    /// PDA bump seed.
    pub bump: u8,
}

impl TreasuryAccount {
    // discriminator(8) + pubkey(32) + u64(8) + u64(8) + u8(1)
    const LEN: usize = 8 + 32 + 8 + 8 + 1;
}

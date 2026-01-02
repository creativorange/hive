use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("MetaTreasury11111111111111111111111111111111");

#[program]
pub mod meta_treasury {
    use super::*;

    /// Initialize the treasury with an initial SOL deposit
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_sol = amount;
        treasury.profit_pool = 0;
        treasury.emergency_multisig = ctx.accounts.multisig.key();
        treasury.is_initialized = true;
        treasury.bump = ctx.bumps.treasury;

        // Transfer SOL to treasury PDA
        if amount > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        emit!(TreasuryInitialized {
            authority: treasury.authority,
            initial_amount: amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Add profits to the pool for later distribution
    pub fn add_profits(ctx: Context<AddProfits>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        
        require!(treasury.is_initialized, MetaTreasuryError::NotInitialized);
        require!(amount > 0, MetaTreasuryError::InvalidAmount);

        // Transfer SOL to treasury
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            amount,
        )?;

        treasury.total_sol = treasury.total_sol.checked_add(amount).unwrap();
        treasury.profit_pool = treasury.profit_pool.checked_add(amount).unwrap();

        emit!(ProfitsAdded {
            amount,
            new_total: treasury.total_sol,
            new_profit_pool: treasury.profit_pool,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Distribute profits proportionally to a holder
    pub fn distribute_profits(
        ctx: Context<DistributeProfits>,
        holder_share_bps: u16, // Basis points (100 = 1%)
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        
        require!(treasury.is_initialized, MetaTreasuryError::NotInitialized);
        require!(treasury.profit_pool > 0, MetaTreasuryError::NoProfits);
        require!(holder_share_bps > 0 && holder_share_bps <= 10000, MetaTreasuryError::InvalidShare);

        let distribution_amount = (treasury.profit_pool as u128)
            .checked_mul(holder_share_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        require!(distribution_amount > 0, MetaTreasuryError::InvalidAmount);
        require!(distribution_amount <= treasury.profit_pool, MetaTreasuryError::InsufficientFunds);

        // Transfer from treasury PDA to holder
        let seeds = &[
            b"treasury".as_ref(),
            &[treasury.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? -= distribution_amount;
        **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += distribution_amount;

        treasury.profit_pool = treasury.profit_pool.checked_sub(distribution_amount).unwrap();
        treasury.total_sol = treasury.total_sol.checked_sub(distribution_amount).unwrap();

        emit!(ProfitsDistributed {
            holder: ctx.accounts.holder.key(),
            amount: distribution_amount,
            share_bps: holder_share_bps,
            remaining_pool: treasury.profit_pool,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Emergency withdrawal - requires multisig authority
    pub fn withdraw_emergency(ctx: Context<WithdrawEmergency>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        
        require!(treasury.is_initialized, MetaTreasuryError::NotInitialized);
        require!(amount > 0 && amount <= treasury.total_sol, MetaTreasuryError::InsufficientFunds);

        // Transfer from treasury PDA to destination
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.destination.to_account_info().try_borrow_mut_lamports()? += amount;

        treasury.total_sol = treasury.total_sol.checked_sub(amount).unwrap();

        emit!(EmergencyWithdrawal {
            multisig: ctx.accounts.multisig.key(),
            destination: ctx.accounts.destination.key(),
            amount,
            remaining: treasury.total_sol,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update the multisig authority
    pub fn update_multisig(ctx: Context<UpdateMultisig>, new_multisig: Pubkey) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        
        require!(treasury.is_initialized, MetaTreasuryError::NotInitialized);

        let old_multisig = treasury.emergency_multisig;
        treasury.emergency_multisig = new_multisig;

        emit!(MultisigUpdated {
            old_multisig,
            new_multisig,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryState::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, TreasuryState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Multisig account for emergency operations
    pub multisig: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddProfits<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, TreasuryState>,
    
    #[account(mut, constraint = authority.key() == treasury.authority)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeProfits<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, TreasuryState>,
    
    #[account(constraint = authority.key() == treasury.authority)]
    pub authority: Signer<'info>,
    
    /// CHECK: Holder receiving profit distribution
    #[account(mut)]
    pub holder: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawEmergency<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, TreasuryState>,
    
    #[account(constraint = multisig.key() == treasury.emergency_multisig)]
    pub multisig: Signer<'info>,
    
    /// CHECK: Destination for emergency withdrawal
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMultisig<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, TreasuryState>,
    
    #[account(constraint = multisig.key() == treasury.emergency_multisig)]
    pub multisig: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct TreasuryState {
    pub authority: Pubkey,
    pub emergency_multisig: Pubkey,
    pub total_sol: u64,
    pub profit_pool: u64,
    pub is_initialized: bool,
    pub bump: u8,
}

#[error_code]
pub enum MetaTreasuryError {
    #[msg("Treasury not initialized")]
    NotInitialized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("No profits available for distribution")]
    NoProfits,
    #[msg("Invalid share percentage")]
    InvalidShare,
    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,
}

#[event]
pub struct TreasuryInitialized {
    pub authority: Pubkey,
    pub initial_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProfitsAdded {
    pub amount: u64,
    pub new_total: u64,
    pub new_profit_pool: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProfitsDistributed {
    pub holder: Pubkey,
    pub amount: u64,
    pub share_bps: u16,
    pub remaining_pool: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmergencyWithdrawal {
    pub multisig: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub remaining: u64,
    pub timestamp: i64,
}

#[event]
pub struct MultisigUpdated {
    pub old_multisig: Pubkey,
    pub new_multisig: Pubkey,
    pub timestamp: i64,
}

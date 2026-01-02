use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::types::DataV2;

declare_id!("MetaNft111111111111111111111111111111111111");

#[program]
pub mod meta_nft {
    use super::*;

    /// Initialize the NFT collection config
    pub fn initialize_collection(
        ctx: Context<InitializeCollection>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.collection_config;
        config.authority = ctx.accounts.authority.key();
        config.total_minted = 0;
        config.mint_price_lamports = 100_000_000; // 0.1 SOL default
        config.is_active = true;
        config.bump = ctx.bumps.collection_config;

        emit!(CollectionInitialized {
            authority: config.authority,
            name: name.clone(),
            symbol: symbol.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Mint a Strategy NFT
    pub fn mint_strategy_nft(
        ctx: Context<MintStrategyNft>,
        strategy_id: String,
        genes_hash: String,
        name: String,
        symbol: String,
        uri: String,
        archetype: String,
        generation: u32,
        fitness_score: u64,
        total_pnl: i64,
        win_rate: u64,
        trades_executed: u32,
    ) -> Result<()> {
        let config = &mut ctx.accounts.collection_config;
        
        require!(config.is_active, MetaNftError::MintingPaused);
        
        // Verify payment
        let rent = Rent::get()?;
        let required_lamports = config.mint_price_lamports;
        
        // Transfer mint fee to treasury
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            required_lamports,
        )?;

        // Mint NFT token
        let seeds = &[
            b"collection".as_ref(),
            &[config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.collection_config.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Create metadata
        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(vec![
                mpl_token_metadata::types::Creator {
                    address: ctx.accounts.collection_config.key(),
                    verified: true,
                    share: 100,
                },
            ]),
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.collection_config.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.collection_config.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            data,
            true,
            true,
            None,
        )?;

        // Create master edition (makes it an NFT)
        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.collection_config.to_account_info(),
                    mint_authority: ctx.accounts.collection_config.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            Some(0), // Max supply of 0 means it's a 1/1
        )?;

        // Store strategy data on-chain
        let strategy_nft = &mut ctx.accounts.strategy_nft;
        strategy_nft.mint = ctx.accounts.mint.key();
        strategy_nft.strategy_id = strategy_id.clone();
        strategy_nft.genes_hash = genes_hash.clone();
        strategy_nft.owner = ctx.accounts.payer.key();
        strategy_nft.minted_at = Clock::get()?.unix_timestamp;
        strategy_nft.mint_price = required_lamports;
        strategy_nft.archetype = archetype.clone();
        strategy_nft.generation = generation;
        strategy_nft.fitness_score = fitness_score;
        strategy_nft.total_pnl = total_pnl;
        strategy_nft.win_rate = win_rate;
        strategy_nft.trades_executed = trades_executed;
        strategy_nft.bump = ctx.bumps.strategy_nft;

        config.total_minted = config.total_minted.checked_add(1).unwrap();

        emit!(StrategyNftMinted {
            mint: ctx.accounts.mint.key(),
            owner: ctx.accounts.payer.key(),
            strategy_id,
            genes_hash,
            archetype,
            generation,
            fitness_score,
            total_pnl,
            mint_price: required_lamports,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update mint price (admin only)
    pub fn update_mint_price(ctx: Context<UpdateConfig>, new_price: u64) -> Result<()> {
        let config = &mut ctx.accounts.collection_config;
        let old_price = config.mint_price_lamports;
        config.mint_price_lamports = new_price;

        emit!(MintPriceUpdated {
            old_price,
            new_price,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Pause/unpause minting (admin only)
    pub fn toggle_minting(ctx: Context<UpdateConfig>, is_active: bool) -> Result<()> {
        let config = &mut ctx.accounts.collection_config;
        config.is_active = is_active;

        emit!(MintingToggled {
            is_active,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Transfer authority (admin only)
    pub fn transfer_authority(ctx: Context<UpdateConfig>, new_authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.collection_config;
        let old_authority = config.authority;
        config.authority = new_authority;

        emit!(AuthorityTransferred {
            old_authority,
            new_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + CollectionConfig::INIT_SPACE,
        seeds = [b"collection"],
        bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(strategy_id: String)]
pub struct MintStrategyNft<'info> {
    #[account(
        mut,
        seeds = [b"collection"],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        init,
        payer = payer,
        space = 8 + StrategyNftData::INIT_SPACE,
        seeds = [b"strategy_nft", strategy_id.as_bytes()],
        bump
    )]
    pub strategy_nft: Account<'info, StrategyNftData>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = collection_config,
        mint::freeze_authority = collection_config,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata account (created via CPI)
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Master edition account (created via CPI)
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: Treasury to receive mint fees
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"collection"],
        bump = collection_config.bump,
        constraint = authority.key() == collection_config.authority @ MetaNftError::Unauthorized
    )]
    pub collection_config: Account<'info, CollectionConfig>,
    
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct CollectionConfig {
    pub authority: Pubkey,
    pub total_minted: u64,
    pub mint_price_lamports: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StrategyNftData {
    pub mint: Pubkey,
    #[max_len(64)]
    pub strategy_id: String,
    #[max_len(64)]
    pub genes_hash: String,
    pub owner: Pubkey,
    pub minted_at: i64,
    pub mint_price: u64,
    #[max_len(32)]
    pub archetype: String,
    pub generation: u32,
    pub fitness_score: u64,
    pub total_pnl: i64,
    pub win_rate: u64,
    pub trades_executed: u32,
    pub bump: u8,
}

#[error_code]
pub enum MetaNftError {
    #[msg("Minting is currently paused")]
    MintingPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid strategy data")]
    InvalidStrategyData,
}

#[event]
pub struct CollectionInitialized {
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub timestamp: i64,
}

#[event]
pub struct StrategyNftMinted {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub strategy_id: String,
    pub genes_hash: String,
    pub archetype: String,
    pub generation: u32,
    pub fitness_score: u64,
    pub total_pnl: i64,
    pub mint_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct MintPriceUpdated {
    pub old_price: u64,
    pub new_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct MintingToggled {
    pub is_active: bool,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

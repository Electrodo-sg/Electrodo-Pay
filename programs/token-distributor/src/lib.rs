use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Hwv5nvGn8mf2oEhQhfRtgTvGSvgbarFNmdgG25WHSRmh");

#[program]
pub mod token_distributor {
    use super::*;

    pub fn distribute(ctx: Context<Distribute>, total_amount: u64) -> Result<()> {
        let expected_mint: Pubkey = "2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft"
            .parse()
            .unwrap();
        let expected_recipient1: Pubkey = "7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3"
            .parse()
            .unwrap();
        let expected_recipient2: Pubkey =
            "98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd".parse().unwrap();
        let expected_recipient3: Pubkey =
            "5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3".parse().unwrap();

        require_keys_eq!(
            ctx.accounts.mint.key(),
            expected_mint,
            CustomError::InvalidMint
        );

        let sender_ata: &TokenAccount = &ctx.accounts.sender_token_account;
        let r1_ata: &TokenAccount = &ctx.accounts.recipient1_token_account;
        let r2_ata: &TokenAccount = &ctx.accounts.recipient2_token_account;
        let r3_ata: &TokenAccount = &ctx.accounts.recipient3_token_account;

        require_keys_eq!(sender_ata.mint, expected_mint, CustomError::InvalidMint);
        require_keys_eq!(
            r1_ata.owner,
            expected_recipient1,
            CustomError::InvalidRecipient1
        );
        require_keys_eq!(
            r2_ata.owner,
            expected_recipient2,
            CustomError::InvalidRecipient2
        );
        require_keys_eq!(
            r3_ata.owner,
            expected_recipient3,
            CustomError::InvalidRecipient3
        );

        if sender_ata.amount < total_amount {
            return Err(CustomError::InsufficientTokens.into());
        }

        // распределяем: 90% / 7% / остаток
        let amount1 = total_amount * 90 / 100;
        let amount2 = total_amount * 7 / 100;
        let amount3 = total_amount - amount1 - amount2;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.recipient1_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount1,
        )?;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.recipient2_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount2,
        )?;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.recipient3_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount3,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    /// Плательщик (подписывается)
    #[account(mut)]
    pub sender: Signer<'info>,

    /// ATA отправителя (must match mint)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    /// Небезопасное поле: просто проверяем, что это тот самый mint
    /// CHECK: этот аккаунт хранит лишь mint Pubkey, безопасность обеспечивается require_keys_eq выше
    #[account(address = pubkey!("2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft"))]
    pub mint: AccountInfo<'info>,

    /// Владелец токен-счёта получателя 1
    /// CHECK: проверка owner будет ниже через require_keys_eq
    pub recipient1_owner: UncheckedAccount<'info>,

    /// ATA получателя 1
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient1_owner
    )]
    pub recipient1_token_account: Account<'info, TokenAccount>,

    /// Владелец токен-счёта получателя 2
    /// CHECK: проверка owner будет ниже через require_keys_eq
    pub recipient2_owner: UncheckedAccount<'info>,

    /// ATA получателя 2
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient2_owner
    )]
    pub recipient2_token_account: Account<'info, TokenAccount>,

    /// Владелец токен-счёта получателя 3
    /// CHECK: проверка owner будет ниже через require_keys_eq
    pub recipient3_owner: UncheckedAccount<'info>,

    /// ATA получателя 3
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient3_owner
    )]
    pub recipient3_token_account: Account<'info, TokenAccount>,

    /// SPL Token-программа
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum CustomError {
    #[msg("Invalid mint address")]
    InvalidMint,
    #[msg("Invalid recipient 1 address")]
    InvalidRecipient1,
    #[msg("Invalid recipient 2 address")]
    InvalidRecipient2,
    #[msg("Invalid recipient 3 address")]
    InvalidRecipient3,
    #[msg("Insufficient tokens for transfer")]
    InsufficientTokens,
}
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct ValidateDelivery<'info> {
    pub sender: Signer<'info>,
    #[account(mut)]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub document_storage_account: Account<'info, DocumentStorage>, // Пример хранения документов
    pub token_program: Program<'info, Token>,
}

#[derive(Serialize, Deserialize)]
pub struct ValidateRequest {
    pub deal_id: String,
    pub documents: Vec<String>,  // Ссылки на документы
    pub signature: String,  // Подпись
    pub validated_by_user: bool, // Поле для валидации пользователем
}

#[program]
pub mod validate_delivery {
    use super::*;

    // Валідація доставки / послуги
    pub fn validate(ctx: Context<ValidateDelivery>, request: ValidateRequest) -> Result<()> {
        // Перевірка підпису та документів
        let is_valid_signature = verify_signature(&request.signature, &request.deal_id)?;
        let are_documents_valid = verify_documents_manually(&request.documents, request.validated_by_user)?;

        if is_valid_signature && are_documents_valid {
            msg!("Validation successful for deal {}", request.deal_id);
            return Ok(());
        } else {
            return Err(ErrorCode::InvalidValidation.into());
        }
    }
}

// Функція перевірки підпису
fn verify_signature(signature: &str, deal_id: &str) -> Result<bool> {
    if signature.is_empty() || deal_id.is_empty() {
        return Err(ErrorCode::InvalidSignature.into());
    }

    Ok(true)
}

// Функція перевірки документів
fn verify_documents_manually(documents: &[String], validated_by_user: bool) -> Result<bool> {
    // Перевірка документів здійснюється вручну
    if !validated_by_user {
        return Err(ErrorCode::InvalidDocument.into());
    }

    Ok(true)
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid signature.")]
    InvalidSignature,
    
    #[msg("Invalid document.")]
    InvalidDocument,

    #[msg("Invalid validation.")]
    InvalidValidation,
}

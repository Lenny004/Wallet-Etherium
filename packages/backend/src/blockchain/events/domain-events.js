import crypto from 'node:crypto';

export const BlockchainEvents = Object.freeze({
  IMAGE_TOKENIZATION_REQUESTED: 'subir_pdf.image_tokenization_requested',
  IMAGE_TOKENIZED: 'subir_pdf.image_tokenized',
  IMAGE_MAINNET_UPLOAD_REQUESTED: 'subir_pdf.image_mainnet_upload_requested',
  IMAGE_MAINNET_UPLOADED: 'subir_pdf.image_mainnet_uploaded',
  MONEY_TRANSFER_REQUESTED: 'enviar_dinero.money_transfer_requested',
  MONEY_TRANSFER_VALIDATED: 'enviar_dinero.money_transfer_validated',
  MONEY_TRANSFER_COMPLETED: 'enviar_dinero.money_transfer_completed',
  CONTRACT_VALIDATION_FAILED: 'shared.contract_validation_failed'
});

/**
 * @param {string} type
 * @param {Record<string, unknown>} payload
 */
export function createDomainEvent(type, payload) {
  return {
    id: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    payload
  };
}

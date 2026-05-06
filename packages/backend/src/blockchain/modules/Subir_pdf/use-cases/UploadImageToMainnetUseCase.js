import crypto from 'node:crypto';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';
import { validateContract } from '../../../../contracts/validate-contract.js';

export class UploadImageToMainnetUseCase {
  /**
   * @param {{imageRepository: any, eventBus: any}} deps
   */
  
  constructor({ imageRepository, eventBus }) {
    this.imageRepository = imageRepository;
    this.eventBus = eventBus;
  }

  /**
   * @param {{tokenId: string, contractName: string}} command
   */
  async execute(command) {
    const imageToken = this.imageRepository.findByTokenId(command.tokenId);
    if (!imageToken) {
      throw new Error('Token de imagen no encontrado.');
    }

    const contractValidation = validateContract({
      contractName: command.contractName,
      operation: 'publish-mainnet',
      payload: { tokenId: command.tokenId }
    });

    if (!contractValidation.ok) {
      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.CONTRACT_VALIDATION_FAILED, {
          module: 'Subir_pdf',
          operation: 'publish-mainnet',
          reason: contractValidation.reason
        })
      );
      throw new Error(contractValidation.reason);
    }

    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const updated = this.imageRepository.update(command.tokenId, {
      status: 'mainnet_uploaded',
      txHash
    });

    await this.eventBus.publish(
      createDomainEvent(BlockchainEvents.IMAGE_MAINNET_UPLOADED, {
        tokenId: command.tokenId,
        txHash
      })
    );

    return updated;
  }
}

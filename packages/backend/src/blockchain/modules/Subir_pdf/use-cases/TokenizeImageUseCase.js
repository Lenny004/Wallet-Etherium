import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';
import { createImageToken } from '../entities/ImageToken.js';

export class TokenizeImageUseCase {
  /**
   * @param {{imageRepository: any, eventBus: any}} deps
   */
  constructor({ imageRepository, eventBus }) {
    this.imageRepository = imageRepository;
    this.eventBus = eventBus;
  }

  /**
   * @param {{fileName: string, mimeType: string, contentBase64: string}} command
   */
  async execute(command) {
    const imageToken = createImageToken(command);
    this.imageRepository.save(imageToken);

    await this.eventBus.publish(
      createDomainEvent(BlockchainEvents.IMAGE_TOKENIZED, {
        tokenId: imageToken.tokenId,
        fileName: imageToken.fileName,
        status: imageToken.status
      })
    );

    return imageToken;
  }
}

import { z } from 'zod';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';
import { validateContract } from '../../../../contracts/validate-contract.js';

const tokenizeImageSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(100),
  contentBase64: z.string().trim().min(20),
  contractName: z.string().trim().min(3)
});

const uploadMainnetSchema = z.object({
  tokenId: z.string().trim().min(3),
  contractName: z.string().trim().min(3)
});

export class ImageUploadController {
  /**
   * @param {{eventBus: any, tokenizeImageUseCase: any, uploadImageToMainnetUseCase: any}} deps
   */
  constructor({ eventBus, tokenizeImageUseCase, uploadImageToMainnetUseCase }) {
    this.eventBus = eventBus;
    this.tokenizeImageUseCase = tokenizeImageUseCase;
    this.uploadImageToMainnetUseCase = uploadImageToMainnetUseCase;
  }

  tokenizeImage = async (req, res, next) => {
    try {
      const parsed = tokenizeImageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ message: 'Carga de imagen inválida.' });
      }

      const { fileName, mimeType, contentBase64, contractName } = parsed.data;
      const contractValidation = validateContract({
        contractName,
        operation: 'tokenize-image',
        payload: { fileName, contentBase64 }
      });

      if (!contractValidation.ok) {
        await this.eventBus.publish(
          createDomainEvent(BlockchainEvents.CONTRACT_VALIDATION_FAILED, {
            module: 'Subir_pdf',
            operation: 'tokenize-image',
            reason: contractValidation.reason
          })
        );
        return res.status(422).json({ message: contractValidation.reason });
      }

      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.IMAGE_TOKENIZATION_REQUESTED, {
          fileName
        })
      );

      const tokenizedImage = await this.tokenizeImageUseCase.execute({ fileName, mimeType, contentBase64 });
      return res.status(201).json(tokenizedImage);
    } catch (error) {
      return next(error);
    }
  };

  uploadToMainnet = async (req, res, next) => {
    try {
      const parsed = uploadMainnetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ message: 'Solicitud mainnet inválida.' });
      }

      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.IMAGE_MAINNET_UPLOAD_REQUESTED, {
          tokenId: parsed.data.tokenId
        })
      );

      const image = await this.uploadImageToMainnetUseCase.execute(parsed.data);
      return res.status(200).json(image);
    } catch (error) {
      return next(error);
    }
  };
}

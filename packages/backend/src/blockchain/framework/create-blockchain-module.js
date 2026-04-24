import { InMemoryEventBus } from '../infrastructure/InMemoryEventBus.js';
import { InMemoryImageRepository } from '../infrastructure/InMemoryImageRepository.js';
import { InMemoryTransferRepository } from '../infrastructure/InMemoryTransferRepository.js';
import { BlockchainWebSocketGateway } from '../infrastructure/ws/BlockchainWebSocketGateway.js';
import { TokenizeImageUseCase } from '../modules/Subir_pdf/use-cases/TokenizeImageUseCase.js';
import { UploadImageToMainnetUseCase } from '../modules/Subir_pdf/use-cases/UploadImageToMainnetUseCase.js';
import { RequestMoneyTransferUseCase } from '../modules/Enviar_dinero/use-cases/RequestMoneyTransferUseCase.js';
import { ValidateAndExecuteTransferUseCase } from '../modules/Enviar_dinero/use-cases/ValidateAndExecuteTransferUseCase.js';
import { ImageUploadController } from '../modules/Subir_pdf/interface-adapters/ImageUploadController.js';
import { MoneyTransferController } from '../modules/Enviar_dinero/interface-adapters/MoneyTransferController.js';
import { createSubirPdfRoutes } from '../modules/Subir_pdf/framework/routes.js';
import { createEnviarDineroRoutes } from '../modules/Enviar_dinero/framework/routes.js';
import { registerBlockchainConsumers } from '../application/register-blockchain-consumers.js';

/**
 * @param {{server: import('node:http').Server}} deps
 */
export function createBlockchainModule({ server }) {
  const eventBus = new InMemoryEventBus();
  const webSocketGateway = new BlockchainWebSocketGateway(server);
  const imageRepository = new InMemoryImageRepository();
  const transferRepository = new InMemoryTransferRepository();

  const tokenizeImageUseCase = new TokenizeImageUseCase({ imageRepository, eventBus });
  const uploadImageToMainnetUseCase = new UploadImageToMainnetUseCase({ imageRepository, eventBus });
  const requestMoneyTransferUseCase = new RequestMoneyTransferUseCase({ transferRepository });
  const validateAndExecuteTransferUseCase = new ValidateAndExecuteTransferUseCase({
    eventBus,
    transferRepository
  });

  const imageUploadController = new ImageUploadController({
    eventBus,
    tokenizeImageUseCase,
    uploadImageToMainnetUseCase
  });
  const moneyTransferController = new MoneyTransferController({
    eventBus,
    requestMoneyTransferUseCase
  });

  registerBlockchainConsumers({
    eventBus,
    validateAndExecuteTransferUseCase,
    webSocketGateway
  });

  return {
    subirPdfRouter: createSubirPdfRoutes({ imageUploadController }),
    enviarDineroRouter: createEnviarDineroRoutes({ moneyTransferController })
  };
}

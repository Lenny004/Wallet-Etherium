import { BlockchainEvents } from '../events/domain-events.js';

/**
 * @param {{eventBus: any, validateAndExecuteTransferUseCase: any, webSocketGateway: any}} deps
 */
export function registerBlockchainConsumers({ eventBus, validateAndExecuteTransferUseCase, webSocketGateway }) {
  const forwardToWebSocket = async (event) => {
    webSocketGateway.publish(event);
  };

  const webSocketForwardingEvents = [
    BlockchainEvents.IMAGE_TOKENIZATION_REQUESTED,
    BlockchainEvents.IMAGE_TOKENIZED,
    BlockchainEvents.IMAGE_MAINNET_UPLOAD_REQUESTED,
    BlockchainEvents.IMAGE_MAINNET_UPLOADED,
    BlockchainEvents.MONEY_TRANSFER_REQUESTED,
    BlockchainEvents.MONEY_TRANSFER_VALIDATED,
    BlockchainEvents.MONEY_TRANSFER_COMPLETED,
    BlockchainEvents.CONTRACT_VALIDATION_FAILED,
    BlockchainEvents.POLICY_VALIDATION_FAILED
  ];

  for (const eventType of webSocketForwardingEvents) {
    eventBus.subscribe(eventType, forwardToWebSocket);
  }

  eventBus.subscribe(BlockchainEvents.MONEY_TRANSFER_REQUESTED, async (event) => {
    try {
      await validateAndExecuteTransferUseCase.execute({
        transferId: String(event.payload.transferId),
        contractName: String(event.payload.contractName)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[MONEY_TRANSFER_REQUESTED]', message);
    }
  });
}

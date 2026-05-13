import crypto from 'node:crypto';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';
import { runMoneyTransferPreExecutionValidation } from '../../../../transaction-validation/orchestrator.js';

export class ValidateAndExecuteTransferUseCase {
  /**
   * @param {{eventBus: any, transferRepository: any}} deps
   */
  constructor({ eventBus, transferRepository }) {
    this.eventBus = eventBus;
    this.transferRepository = transferRepository;
  }

  /**
   * @param {{transferId: string, contractName: string}} command
   */
  async execute(command) {
    const transfer = this.transferRepository.findById(command.transferId);
    if (!transfer) {
      throw new Error('Transferencia no encontrada.');
    }

    const validation = runMoneyTransferPreExecutionValidation({
      contractName: command.contractName,
      transfer
    });

    if (!validation.ok) {
      this.transferRepository.update(transfer.transferId, { status: 'rejected' });
      const eventType =
        validation.failedStage === 'POLICY'
          ? BlockchainEvents.POLICY_VALIDATION_FAILED
          : BlockchainEvents.CONTRACT_VALIDATION_FAILED;
      await this.eventBus.publish(
        createDomainEvent(eventType, {
          module: 'Enviar_dinero',
          operation: 'money-transfer',
          transferId: transfer.transferId,
          failedStage: validation.failedStage,
          codes: validation.codes,
          reason: validation.message
        })
      );
      throw new Error(validation.message ?? 'Validación rechazada.');
    }

    const validated = this.transferRepository.update(transfer.transferId, { status: 'validated' });
    await this.eventBus.publish(
      createDomainEvent(BlockchainEvents.MONEY_TRANSFER_VALIDATED, {
        transferId: transfer.transferId,
        status: validated?.status ?? 'validated'
      })
    );

    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const completed = this.transferRepository.update(transfer.transferId, {
      status: 'completed',
      txHash
    });

    await this.eventBus.publish(
      createDomainEvent(BlockchainEvents.MONEY_TRANSFER_COMPLETED, {
        transferId: transfer.transferId,
        txHash,
        amountEth: transfer.amountEth
      })
    );

    return completed;
  }
}

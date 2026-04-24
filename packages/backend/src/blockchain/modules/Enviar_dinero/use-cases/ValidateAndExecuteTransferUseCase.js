import crypto from 'node:crypto';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';
import { validateContract } from '../../../../contracts/validate-contract.js';

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

    const contractValidation = validateContract({
      contractName: command.contractName,
      operation: 'money-transfer',
      payload: {
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        amountEth: transfer.amountEth
      }
    });

    if (!contractValidation.ok) {
      this.transferRepository.update(transfer.transferId, { status: 'rejected' });
      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.CONTRACT_VALIDATION_FAILED, {
          module: 'Enviar_dinero',
          operation: 'money-transfer',
          transferId: transfer.transferId,
          reason: contractValidation.reason
        })
      );
      throw new Error(contractValidation.reason);
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

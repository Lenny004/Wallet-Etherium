import { z } from 'zod';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';

const moneyTransferSchema = z.object({
  fromAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  toAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  amountEth: z.coerce.number().positive(),
  contractName: z.string().trim().min(3)
});

export class MoneyTransferController {
  /**
   * @param {{eventBus: any, requestMoneyTransferUseCase: any}} deps
   */
  constructor({ eventBus, requestMoneyTransferUseCase }) {
    this.eventBus = eventBus;
    this.requestMoneyTransferUseCase = requestMoneyTransferUseCase;
  }

  requestTransfer = async (req, res, next) => {
    try {
      const parsed = moneyTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ message: 'Solicitud de transferencia inválida.' });
      }

      const { fromAddress, toAddress, amountEth, contractName } = parsed.data;
      const transfer = await this.requestMoneyTransferUseCase.execute({
        fromAddress,
        toAddress,
        amountEth
      });

      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.MONEY_TRANSFER_REQUESTED, {
          transferId: transfer.transferId,
          contractName
        })
      );

      return res.status(202).json({
        transferId: transfer.transferId,
        status: transfer.status
      });
    } catch (error) {
      return next(error);
    }
  };
}

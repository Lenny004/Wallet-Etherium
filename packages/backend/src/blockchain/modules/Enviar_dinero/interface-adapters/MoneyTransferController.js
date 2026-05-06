import { z } from 'zod';
import { getAddress, parseEther } from 'ethers';
import { BlockchainEvents, createDomainEvent } from '../../../events/domain-events.js';

/** Identificador fijo del “contrato” en el demo EDA (`validate-contract.js` exige nombre con `wallet`). */
const WALLET_TRANSFER_CONTRACT_NAME = 'WalletTransferContractV1';

const moneyTransferSchema = z.object({
  toAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  amountEth: z
    .string()
    .trim()
    .min(1)
    .refine(
      (s) => {
        try {
          return parseEther(s) > 0n;
        } catch {
          return false;
        }
      },
      { message: 'Monto ETH inválido.' }
    )
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

      let fromAddress;
      try {
        const wallet = typeof req.user?.walletAddress === 'string' ? req.user.walletAddress : '';
        fromAddress = getAddress(wallet);
      } catch {
        return res.status(401).json({ message: 'Sesión sin dirección de wallet válida.' });
      }

      let toAddress;
      try {
        toAddress = getAddress(parsed.data.toAddress);
      } catch {
        return res.status(422).json({ message: 'Dirección de destino inválida.' });
      }

      if (toAddress.toLowerCase() === fromAddress.toLowerCase()) {
        return res.status(422).json({ message: 'El destino no puede ser la misma wallet de la sesión.' });
      }

      const { amountEth } = parsed.data;
      const transfer = await this.requestMoneyTransferUseCase.execute({
        fromAddress,
        toAddress,
        amountEth
      });

      await this.eventBus.publish(
        createDomainEvent(BlockchainEvents.MONEY_TRANSFER_REQUESTED, {
          transferId: transfer.transferId,
          contractName: WALLET_TRANSFER_CONTRACT_NAME
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

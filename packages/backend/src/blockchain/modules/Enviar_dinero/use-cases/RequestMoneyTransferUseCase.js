import { createMoneyTransfer } from '../entities/MoneyTransfer.js';

export class RequestMoneyTransferUseCase {
  /**
   * @param {{transferRepository: any}} deps
   */
  constructor({ transferRepository }) {
    this.transferRepository = transferRepository;
  }

  /**
   * @param {{fromAddress: string, toAddress: string, amountEth: number}} command
   */
  async execute(command) {
    const transfer = createMoneyTransfer(command);
    this.transferRepository.save(transfer);
    return transfer;
  }
}

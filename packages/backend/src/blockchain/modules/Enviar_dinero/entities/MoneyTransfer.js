import crypto from 'node:crypto';

/**
 * @param {{fromAddress: string, toAddress: string, amountEth: number}} input
 */
export function createMoneyTransfer(input) {
  return {
    transferId: `trx_${crypto.randomUUID()}`,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    amountEth: input.amountEth,
    status: 'requested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

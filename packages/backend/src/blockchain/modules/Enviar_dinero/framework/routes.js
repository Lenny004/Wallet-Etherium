import { Router } from 'express';

/**
 * @param {{moneyTransferController: any}} deps
 */
export function createEnviarDineroRoutes({ moneyTransferController }) {
  const router = Router();
  router.post('/request', moneyTransferController.requestTransfer);
  return router;
}

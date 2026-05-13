import { runContractLayer } from './contract-layer.js';
import { runMoneyTransferPolicyLayer } from './policy-layer.js';

/**
 * Orquestador: orden fijo CONTRACT → POLICY (fail-fast). Sin ejecución on-chain hasta `ok: true`.
 *
 * @param {{ contractName: string, transfer: { transferId: string, fromAddress: string, toAddress: string, amountEth: string } }} input
 * @returns {{
 *   ok: boolean,
 *   correlationId: string,
 *   failedStage: 'CONTRACT' | 'POLICY' | null,
 *   codes: string[],
 *   message: string | null
 * }}
 */
export function runMoneyTransferPreExecutionValidation(input) {
  const correlationId = input.transfer.transferId;

  const contractResult = runContractLayer({
    contractName: input.contractName,
    operation: 'money-transfer',
    payload: {
      fromAddress: input.transfer.fromAddress,
      toAddress: input.transfer.toAddress,
      amountEth: input.transfer.amountEth
    }
  });

  if (!contractResult.ok) {
    return {
      ok: false,
      correlationId,
      failedStage: 'CONTRACT',
      codes: contractResult.codes,
      message: contractResult.message
    };
  }

  const policyResult = runMoneyTransferPolicyLayer(input.transfer);
  if (!policyResult.ok) {
    return {
      ok: false,
      correlationId,
      failedStage: 'POLICY',
      codes: policyResult.codes,
      message: policyResult.message
    };
  }

  return {
    ok: true,
    correlationId,
    failedStage: null,
    codes: [...contractResult.codes, ...policyResult.codes],
    message: null
  };
}

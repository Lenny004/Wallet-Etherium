import { validateContract } from '../contracts/validate-contract.js';

/**
 * Capa de contrato: catálogo de operación, nombre lógico del contrato y payload mínimo.
 *
 * @param {{ contractName: string, operation: 'tokenize-image'|'publish-mainnet'|'money-transfer', payload: Record<string, unknown> }} input
 * @returns {{ ok: boolean, stage: 'CONTRACT', codes: string[], message: string | null }}
 */
export function runContractLayer(input) {
  const result = validateContract(input);
  if (!result.ok) {
    return {
      ok: false,
      stage: 'CONTRACT',
      codes: [result.code],
      message: result.reason
    };
  }
  return {
    ok: true,
    stage: 'CONTRACT',
    codes: ['CONTRACT_OK'],
    message: null
  };
}

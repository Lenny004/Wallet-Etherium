import { z } from 'zod';

const contractValidationSchema = z.object({
  contractName: z.string().trim().min(3),
  operation: z.enum(['tokenize-image', 'publish-mainnet', 'money-transfer']),
  payload: z.record(z.string(), z.unknown())
});

const operationRequirements = {
  'tokenize-image': ['fileName', 'contentBase64'],
  'publish-mainnet': ['tokenId'],
  'money-transfer': ['fromAddress', 'toAddress', 'amountEth']
};

/**
 * Valida contrato funcional antes de ejecutar transacciones blockchain.
 *
 * @param {{contractName: string, operation: 'tokenize-image'|'publish-mainnet'|'money-transfer', payload: Record<string, unknown>}} input
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateContract(input) {
  const parsed = contractValidationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'Contrato inválido: estructura incompleta.' };
  }

  const { contractName, operation, payload } = parsed.data;
  if (!contractName.toLowerCase().includes('wallet')) {
    return { ok: false, reason: 'Contrato inválido: nombre de contrato no permitido.' };
  }

  const requiredFields = operationRequirements[operation] ?? [];
  const missing = requiredFields.filter((field) => payload[field] == null || payload[field] === '');
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Contrato inválido: faltan campos requeridos (${missing.join(', ')}).`
    };
  }

  return { ok: true };
}

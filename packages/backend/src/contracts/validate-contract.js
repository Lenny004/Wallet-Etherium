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
 * Valida el contrato funcional (estructura, nombre y campos obligatorios por operación)
 * antes de encadenar lógica o transacciones en blockchain.
 *
 * Flujo de validación:
 * 1. **Estructura y tipos** — `contractName`, `operation` y `payload` contra el esquema Zod interno.
 * 2. **Nombre de contrato** — `contractName` debe contener la subcadena `wallet` (comparación sin distinguir mayúsculas).
 * 3. **Payload por operación** — según `operation`, exige claves concretas en `payload` (no vacías ni `null`/`undefined`).
 *
 * Para `money-transfer`, conviene que `amountEth` sea una cadena en unidades ETH coherente con validaciones
 * previas (por ejemplo `parseEther` en otra capa); esta función solo comprueba presencia y no vacío.
 *
 * @param {Object} input - Objeto de entrada del contrato funcional.
 * @param {string} input.contractName - Nombre del contrato (trim, mínimo 3 caracteres); debe incluir `"wallet"`.
 * @param {'tokenize-image'|'publish-mainnet'|'money-transfer'} input.operation - Operación a validar.
 * @param {Record<string, unknown>} input.payload - Datos específicos de la operación.
 *
 * @returns {{ ok: true } | { ok: false, reason: string, code: 'CONTRACT_INVALID_STRUCTURE'|'CONTRACT_NAME_NOT_ALLOWED'|'CONTRACT_MISSING_FIELDS' }}
 * Unión discriminada por `ok`: éxito `{ ok: true }`; error con `code` estable para ramas en capas superiores
 * y `reason` legible para logs o respuestas HTTP.
 *
 * @example
 * // Transferencia con payload completo
 * const r = validateContract({
 *   contractName: 'MyWalletCore',
 *   operation: 'money-transfer',
 *   payload: {
 *     fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
 *     toAddress: '0x8ba1f109551bD432803012645aac136c22c9e5',
 *     amountEth: '0.1'
 *   }
 * });
 * // r → { ok: true }
 *
 * @example
 * // Nombre de contrato sin "wallet"
 * validateContract({
 *   contractName: 'PaymentsCore',
 *   operation: 'money-transfer',
 *   payload: { fromAddress: '0x1', toAddress: '0x2', amountEth: '1' }
 * });
 * // → { ok: false, code: 'CONTRACT_NAME_NOT_ALLOWED', reason: '...' }
 *
 * @example
 * // Campos obligatorios faltantes para la operación
 * validateContract({
 *   contractName: 'DevWallet',
 *   operation: 'tokenize-image',
 *   payload: { fileName: 'a.png' }
 * });
 * // → { ok: false, code: 'CONTRACT_MISSING_FIELDS', reason: '...contentBase64...' }
 */
export function validateContract(input) {
  const parsed = contractValidationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'CONTRACT_INVALID_STRUCTURE',
      reason: 'Contrato inválido: estructura incompleta.'
    };
  }

  const { contractName, operation, payload } = parsed.data;
  if (!contractName.toLowerCase().includes('wallet')) {
    return {
      ok: false,
      code: 'CONTRACT_NAME_NOT_ALLOWED',
      reason: 'Contrato inválido: nombre de contrato no permitido.'
    };
  }

  const requiredFields = operationRequirements[operation] ?? [];
  const missing = requiredFields.filter((field) => payload[field] == null || payload[field] === '');
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'CONTRACT_MISSING_FIELDS',
      reason: `Contrato inválido: faltan campos requeridos (${missing.join(', ')}).`
    };
  }

  return { ok: true };
}

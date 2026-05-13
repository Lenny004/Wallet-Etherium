import { getAddress, parseEther } from 'ethers';

/**
 * Capa de política para transferencias ETH (reglas de negocio antes de ejecutar).
 *
 * @param {{ fromAddress: string, toAddress: string, amountEth: string }} transfer
 * @returns {{ ok: boolean, stage: 'POLICY', codes: string[], message: string | null }}
 */
export function runMoneyTransferPolicyLayer(transfer) {
  let from;
  let to;
  try {
    from = getAddress(transfer.fromAddress);
    to = getAddress(transfer.toAddress);
  } catch {
    return {
      ok: false,
      stage: 'POLICY',
      codes: ['POLICY_INVALID_ADDRESS'],
      message: 'Política: dirección de origen o destino inválida.'
    };
  }

  if (from.toLowerCase() === to.toLowerCase()) {
    return {
      ok: false,
      stage: 'POLICY',
      codes: ['POLICY_SELF_TRANSFER'],
      message: 'Política: no se permiten transferencias a la misma wallet de origen.'
    };
  }

  let amountWei;
  try {
    amountWei = parseEther(transfer.amountEth);
  } catch {
    return {
      ok: false,
      stage: 'POLICY',
      codes: ['POLICY_AMOUNT_INVALID'],
      message: 'Política: monto ETH no interpretable.'
    };
  }

  if (amountWei <= 0n) {
    return {
      ok: false,
      stage: 'POLICY',
      codes: ['POLICY_AMOUNT_NON_POSITIVE'],
      message: 'Política: el monto debe ser mayor que cero.'
    };
  }

  const maxEthRaw = process.env.MAX_TRANSFER_ETH?.trim();
  if (maxEthRaw) {
    try {
      const maxWei = parseEther(maxEthRaw);
      if (amountWei > maxWei) {
        return {
          ok: false,
          stage: 'POLICY',
          codes: ['POLICY_MAX_TRANSFER_EXCEEDED'],
          message: `Política: el monto supera el máximo permitido (${maxEthRaw} ETH).`
        };
      }
    } catch {
      // Configuración incorrecta: no bloquea en demo; se ignora el tope.
    }
  }

  const blockedRaw = process.env.TRANSFER_BLOCKED_ADDRESSES ?? '';
  const blocked = blockedRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of blocked) {
    try {
      if (getAddress(entry).toLowerCase() === to.toLowerCase()) {
        return {
          ok: false,
          stage: 'POLICY',
          codes: ['POLICY_DESTINATION_BLOCKED'],
          message: 'Política: la dirección de destino no está permitida.'
        };
      }
    } catch {
      // Entrada de lista inválida: se omite.
    }
  }

  return {
    ok: true,
    stage: 'POLICY',
    codes: ['POLICY_OK'],
    message: null
  };
}

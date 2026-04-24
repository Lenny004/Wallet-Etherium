export class InMemoryTransferRepository {
  constructor() {
    /** @type {Map<string, any>} */
    this.items = new Map();
  }

  /**
   * @param {any} transfer
   */
  save(transfer) {
    this.items.set(transfer.transferId, transfer);
    return transfer;
  }

  /**
   * @param {string} transferId
   */
  findById(transferId) {
    return this.items.get(transferId) ?? null;
  }

  /**
   * @param {string} transferId
   * @param {Partial<any>} patch
   */
  update(transferId, patch) {
    const current = this.items.get(transferId);
    if (!current) {
      return null;
    }
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.items.set(transferId, next);
    return next;
  }
}

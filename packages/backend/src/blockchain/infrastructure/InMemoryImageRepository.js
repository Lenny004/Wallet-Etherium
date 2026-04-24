export class InMemoryImageRepository {
  constructor() {
    /** @type {Map<string, any>} */
    this.items = new Map();
  }

  /**
   * @param {any} imageToken
   */
  save(imageToken) {
    this.items.set(imageToken.tokenId, imageToken);
    return imageToken;
  }

  /**
   * @param {string} tokenId
   */
  findByTokenId(tokenId) {
    return this.items.get(tokenId) ?? null;
  }

  /**
   * @param {string} tokenId
   * @param {Partial<any>} patch
   */
  update(tokenId, patch) {
    const current = this.items.get(tokenId);
    if (!current) {
      return null;
    }
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.items.set(tokenId, next);
    return next;
  }
}

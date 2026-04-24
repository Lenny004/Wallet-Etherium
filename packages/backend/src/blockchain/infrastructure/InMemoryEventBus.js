export class InMemoryEventBus {
  constructor() {
    /** @type {Map<string, Array<(event: any) => Promise<void> | void>>} */
    this.handlers = new Map();
  }

  /**
   * @param {string} eventType
   * @param {(event: any) => Promise<void> | void} handler
   */
  subscribe(eventType, handler) {
    const current = this.handlers.get(eventType) ?? [];
    current.push(handler);
    this.handlers.set(eventType, current);
  }

  /**
   * @param {any} event
   * @returns {Promise<void>}
   */
  async publish(event) {
    const subscribers = this.handlers.get(event.type) ?? [];
    for (const subscriber of subscribers) {
      // Entrega secuencial para preservar orden de dominio.
      await subscriber(event);
    }
  }
}

import { WebSocketServer } from 'ws';

export class BlockchainWebSocketGateway {
  /**
   * @param {import('node:http').Server} server
   */
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws/events' });
    this.wss.on('connection', (socket) => {
      socket.send(
        JSON.stringify({
          type: 'system.connected',
          occurredAt: new Date().toISOString(),
          payload: { message: 'Canal EDA activo.' }
        })
      );
    });
  }

  /**
   * @param {any} event
   */
  publish(event) {
    const serialized = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(serialized);
      }
    }
  }
}

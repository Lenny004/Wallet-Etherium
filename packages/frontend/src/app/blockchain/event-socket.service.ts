import { Injectable, NgZone, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface BlockchainEvent {
  id?: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class EventSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxEvents = 25;

  readonly connected = signal(false);
  readonly events = signal<BlockchainEvent[]>([]);

  constructor(private readonly zone: NgZone) {}

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(environment.wsUrl);
    this.socket = ws;

    ws.onopen = () => {
      this.zone.run(() => {
        this.connected.set(true);
      });
    };

    ws.onmessage = (message) => {
      this.zone.run(() => {
        try {
          const event = JSON.parse(message.data as string) as BlockchainEvent;
          const next = [event, ...this.events()].slice(0, this.maxEvents);
          this.events.set(next);
        } catch {
          // Ignora mensajes no parseables.
        }
      });
    };

    ws.onclose = () => {
      this.zone.run(() => this.connected.set(false));
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1500);
  }
}

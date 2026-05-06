import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type RecentTxType = 'sent' | 'received' | 'contract';
export type RecentTxStatus = 'confirmed' | 'pending' | 'failed';

export interface RecentChainTransaction {
  hash: string;
  type: RecentTxType;
  title: string;
  subtitle: string;
  amount: string;
  status: RecentTxStatus;
}

interface BlockscoutTxRow {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  txreceipt_status: string;
  isError: string;
}

interface BlockscoutTxListResponse {
  status: string;
  message: string;
  result: BlockscoutTxRow[] | string;
}

@Injectable({ providedIn: 'root' })
export class SepoliaTransactionsService {
  private readonly http = inject(HttpClient);

  async fetchRecentForAddress(address: string, limit = 12): Promise<RecentChainTransaction[]> {
    const base = environment.sepoliaExplorerApiUrl;
    const url = `${base}?module=account&action=txlist&address=${encodeURIComponent(
      address
    )}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`;
    const res = await firstValueFrom(this.http.get<BlockscoutTxListResponse>(url));
    if (res.status !== '1' || !Array.isArray(res.result)) {
      return [];
    }
    const lower = address.toLowerCase();
    return res.result.map((row) => this.mapRow(row, lower));
  }

  private mapRow(row: BlockscoutTxRow, addrLower: string): RecentChainTransaction {
    const from = (row.from || '').toLowerCase();
    const to = (row.to || '').toLowerCase();
    const valueWei = row.value && row.value !== '' ? BigInt(row.value) : 0n;
    const isFrom = from === addrLower;
    const isTo = to === addrLower;

    let type: RecentTxType;
    let title: string;
    if (valueWei > 0n) {
      if (isTo) {
        type = 'received';
        title = 'ETH recibido';
      } else if (isFrom) {
        type = 'sent';
        title = 'ETH enviado';
      } else {
        type = 'contract';
        title = 'Movimiento ETH';
      }
    } else {
      type = 'contract';
      title = isFrom ? 'Transacción enviada' : isTo ? 'Transacción recibida' : 'Transacción';
    }

    const peer = isFrom ? row.to : row.from;
    const shortPeer = this.shortAddress(peer);
    const ts = Number(row.timeStamp);
    const when = Number.isFinite(ts)
      ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts * 1000))
      : '—';
    const subtitle = `${shortPeer} · ${when}`;

    const ethStr = this.formatEth(valueWei);
    let amount: string;
    if (valueWei === 0n) {
      amount = '0 ETH';
    } else if (isFrom) {
      amount = `- ${ethStr} ETH`;
    } else if (isTo) {
      amount = `+ ${ethStr} ETH`;
    } else {
      amount = `${ethStr} ETH`;
    }

    const failed = row.isError === '1' || row.txreceipt_status === '0';
    const status: RecentTxStatus = failed ? 'failed' : 'confirmed';

    return {
      hash: row.hash,
      type,
      title,
      subtitle,
      amount,
      status,
    };
  }

  private shortAddress(addr: string | undefined): string {
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return '—';
    }
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  private formatEth(wei: bigint): string {
    const n = Number(wei) / 1e18;
    if (!Number.isFinite(n)) {
      return '…';
    }
    return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  }
}

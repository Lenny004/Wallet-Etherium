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

interface BlockscoutBalanceResponse {
  status: string;
  message?: string;
  result: string;
}

interface JsonRpcResult<T> {
  result?: T;
  error?: { message: string };
}

interface RpcFullTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
}

interface RpcFullBlock {
  timestamp: string;
  transactions: (RpcFullTx | string)[];
}

@Injectable({ providedIn: 'root' })
export class SepoliaTransactionsService {
  private readonly http = inject(HttpClient);

  /** Saldo en wei (explorador público o JSON-RPC local). */
  async fetchBalanceWeiForAddress(address: string): Promise<bigint | null> {
    const explorer = environment.explorerApiUrl?.trim();
    if (explorer) {
      return this.fetchBalanceBlockscout(explorer, address);
    }
    return this.fetchBalanceRpc(address);
  }

  async fetchRecentForAddress(address: string, limit = 12): Promise<RecentChainTransaction[]> {
    const explorer = environment.explorerApiUrl?.trim();
    if (explorer) {
      return this.fetchRecentBlockscout(explorer, address, limit);
    }
    return this.fetchRecentLocalRpc(address, limit);
  }

  private async fetchBalanceBlockscout(base: string, address: string): Promise<bigint | null> {
    const url = `${base}?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest`;
    const res = await firstValueFrom(this.http.get<BlockscoutBalanceResponse>(url));
    if (res.status !== '1' || res.result === undefined || res.result === '') {
      return null;
    }
    try {
      return BigInt(res.result);
    } catch {
      return null;
    }
  }

  private async fetchBalanceRpc(address: string): Promise<bigint | null> {
    const rpcPath = environment.chainRpcBrowserProxyPath?.trim();
    if (!rpcPath) {
      return null;
    }
    try {
      const weiHex = await this.rpcCall<string>('eth_getBalance', [address, 'latest'], rpcPath);
      if (!weiHex || !weiHex.startsWith('0x')) {
        return null;
      }
      return BigInt(weiHex);
    } catch {
      return null;
    }
  }

  private async fetchRecentBlockscout(base: string, address: string, limit: number): Promise<RecentChainTransaction[]> {
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

  /**
   * Escanea bloques recientes vía JSON-RPC (Ganache / nodo local).
   * Pensado para redes sin explorador público.
   */
  private async fetchRecentLocalRpc(address: string, limit: number): Promise<RecentChainTransaction[]> {
    const rpcPath = environment.chainRpcBrowserProxyPath?.trim();
    if (!rpcPath) {
      return [];
    }
    const addrLower = address.toLowerCase();
    let latestHex: string;
    try {
      latestHex = await this.rpcCall<string>('eth_blockNumber', [], rpcPath);
    } catch {
      return [];
    }
    let latest = Number.parseInt(latestHex, 16);
    if (!Number.isFinite(latest)) {
      return [];
    }

    const out: RecentChainTransaction[] = [];
    const maxBlocks = 160;
    let scanned = 0;

    while (latest >= 0 && out.length < limit && scanned < maxBlocks) {
      const blockHex = `0x${latest.toString(16)}`;
      let block: RpcFullBlock | null;
      try {
        block = await this.rpcCall<RpcFullBlock | null>('eth_getBlockByNumber', [blockHex, true], rpcPath);
      } catch {
        block = null;
      }
      scanned++;
      latest -= 1;

      if (!block?.transactions?.length) {
        continue;
      }

      const ts = Number.parseInt(block.timestamp, 16);
      const when = Number.isFinite(ts)
        ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts * 1000))
        : '—';

      for (const raw of block.transactions) {
        if (typeof raw === 'string' || out.length >= limit) {
          continue;
        }
        const tx = raw as RpcFullTx;
        const from = (tx.from || '').toLowerCase();
        const to = (tx.to || '').toLowerCase();
        if (from !== addrLower && to !== addrLower) {
          continue;
        }
        out.push(this.mapRpcTx(tx, addrLower, when));
      }
    }

    return out;
  }

  private async rpcCall<T>(method: string, params: unknown[], rpcPath: string): Promise<T> {
    const body = {
      jsonrpc: '2.0' as const,
      id: 1,
      method,
      params,
    };
    const res = await firstValueFrom(
      this.http.post<JsonRpcResult<T>>(rpcPath, body, {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    if (res.error) {
      throw new Error(res.error.message || 'RPC error');
    }
    if (res.result === undefined) {
      throw new Error('RPC sin resultado');
    }
    return res.result;
  }

  private mapRpcTx(row: RpcFullTx, addrLower: string, whenLabel: string): RecentChainTransaction {
    const from = (row.from || '').toLowerCase();
    const to = (row.to || '').toLowerCase();
    const valueWei = row.value && row.value !== '' ? BigInt(row.value) : 0n;
    const isFrom = from === addrLower;
    const isTo = to === addrLower && row.to !== null;

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

    const peer = isFrom ? row.to ?? '' : row.from;
    const shortPeer = this.shortAddress(peer);

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

    return {
      hash: row.hash,
      type,
      title,
      subtitle: `${shortPeer} · ${whenLabel}`,
      amount,
      status: 'confirmed',
    };
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
    if (!addr || !/^0x[a-fA-F0-9]{40}$/i.test(addr)) {
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

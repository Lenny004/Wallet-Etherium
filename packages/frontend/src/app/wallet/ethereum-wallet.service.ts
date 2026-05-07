import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** chainId de `environment` en hex (p. ej. Ganache 1337 → 0x539). */
export const TARGET_CHAIN_ID_HEX = `0x${environment.chainId.toString(16)}` as const;

type Eip1193Request = { method: string; params?: unknown[] };

export interface Eip1193Provider {
  request(args: Eip1193Request): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const eth = (window as unknown as { ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] } })
    .ethereum;
  if (!eth) {
    return null;
  }
  const multi = eth.providers;
  if (Array.isArray(multi) && multi.length > 0) {
    const mm = multi.find((p) => Boolean((p as { isMetaMask?: boolean }).isMetaMask));
    return mm ?? multi[0] ?? null;
  }
  return eth;
}

function weiHexToEthNumber(weiHex: string): number {
  const wei = BigInt(weiHex);
  return Number(wei) / 1e18;
}

@Injectable({ providedIn: 'root' })
export class EthereumWalletService {
  private readonly auth = inject(AuthService);

  readonly hasProvider = signal(false);
  readonly accounts = signal<string[]>([]);
  readonly chainIdHex = signal<string | null>(null);
  readonly balanceWeiHex = signal<string | null>(null);
  readonly connecting = signal(false);

  private listening = false;
  private boundEth: Eip1193Provider | null = null;
  private onAccountsBound?: (accs: unknown) => void;
  private onChainBound?: () => void;

  readonly connectedAddress = computed(() => this.accounts()[0] ?? null);
  readonly isTargetChain = computed(
    () => (this.chainIdHex()?.toLowerCase() ?? '') === TARGET_CHAIN_ID_HEX.toLowerCase()
  );
  readonly shortAddress = computed(() => {
    const a = this.connectedAddress();
    if (!a) {
      return null;
    }
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  });
  readonly balanceEthNumber = computed(() => {
    const hex = this.balanceWeiHex();
    if (!hex) {
      return null;
    }
    return weiHexToEthNumber(hex);
  });

  constructor() {
    const eth = getInjectedProvider();
    if (eth) {
      this.hasProvider.set(true);
    }
  }

  /**
   * Activa lectura de cuenta/red y eventos EIP-1193 solo para sesión SIWE.
   * Idempotente; no hace nada si la sesión no es por MetaMask/SIWE.
   */
  beginListening(): void {
    if (!this.auth.isWalletSiweSession() || this.listening) {
      return;
    }
    const eth = getInjectedProvider();
    if (!eth) {
      return;
    }
    this.boundEth = eth;
    this.listening = true;
    this.onAccountsBound = (accs: unknown) => {
      this.accounts.set(Array.isArray(accs) ? (accs as string[]) : []);
      void this.refreshChainAndBalance();
    };
    this.onChainBound = () => {
      void this.refreshChainAndBalance();
    };
    eth.on?.('accountsChanged', this.onAccountsBound);
    eth.on?.('chainChanged', this.onChainBound);
    void this.refreshChainAndBalance();
  }

  /** Detiene listeners y limpia estado on-chain (p. ej. al cerrar sesión). */
  reset(): void {
    const eth = this.boundEth;
    if (eth && this.onAccountsBound) {
      eth.removeListener?.('accountsChanged', this.onAccountsBound);
    }
    if (eth && this.onChainBound) {
      eth.removeListener?.('chainChanged', this.onChainBound);
    }
    this.boundEth = null;
    this.onAccountsBound = undefined;
    this.onChainBound = undefined;
    this.listening = false;
    this.accounts.set([]);
    this.chainIdHex.set(null);
    this.balanceWeiHex.set(null);
    this.connecting.set(false);
  }

  private getEth(): Eip1193Provider | null {
    return getInjectedProvider();
  }

  async refreshChainAndBalance(): Promise<void> {
    const eth = this.getEth();
    if (!eth) {
      return;
    }
    try {
      const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
      this.accounts.set(accounts ?? []);
      const cid = (await eth.request({ method: 'eth_chainId' })) as string;
      this.chainIdHex.set(typeof cid === 'string' ? cid.toLowerCase() : null);
      await this.refreshBalance();
    } catch {
      /* ignorar si la wallet no responde */
    }
  }

  async connectMetaMask(): Promise<void> {
    if (!this.auth.isWalletSiweSession()) {
      throw new Error('MetaMask solo está disponible si iniciaste sesión con SIWE (MetaMask).');
    }
    this.beginListening();
    const eth = this.getEth();
    if (!eth) {
      throw new Error('No se detectó MetaMask u otra wallet compatible.');
    }
    this.connecting.set(true);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      this.accounts.set(accounts ?? []);
      await this.ensureTargetChain();
      const cid = (await eth.request({ method: 'eth_chainId' })) as string;
      this.chainIdHex.set(typeof cid === 'string' ? cid.toLowerCase() : null);
      await this.refreshBalance();
    } finally {
      this.connecting.set(false);
    }
  }

  /**
   * Cambia a la red configurada en `environment.chainId`
   * o la registra en MetaMask si no existe.
   */
  async ensureTargetChain(): Promise<void> {
    const eth = this.getEth();
    if (!eth) {
      throw new Error('No se detectó MetaMask u otra wallet compatible.');
    }
    const chainName = environment.networkDisplayName;
    const rpcUrl = environment.chainRpcUrl;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: TARGET_CHAIN_ID_HEX }],
      });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : null;
      if (code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: TARGET_CHAIN_ID_HEX,
              chainName,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [rpcUrl],
            },
          ],
        });
      } else {
        throw err;
      }
    }
    this.chainIdHex.set(TARGET_CHAIN_ID_HEX.toLowerCase());
  }

  async refreshBalance(): Promise<void> {
    const eth = this.getEth();
    const addr = this.connectedAddress();
    if (!eth || !addr || !this.isTargetChain()) {
      this.balanceWeiHex.set(null);
      return;
    }
    const hex = (await eth.request({ method: 'eth_getBalance', params: [addr, 'latest'] })) as string;
    this.balanceWeiHex.set(hex);
  }

  /** Abre un faucet en nueva pestaña si `environment.testnetFaucetUrl` está definido. */
  openTestnetFaucet(): void {
    const url = environment.testnetFaucetUrl?.trim();
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

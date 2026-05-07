import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService, User } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { EthereumWalletService } from '../wallet/ethereum-wallet.service';
import { RecentChainTransaction, SepoliaTransactionsService } from '../wallet/sepolia-transactions.service';

function weiToEthNumber(wei: bigint): number {
  return Number(wei) / 1e18;
}

@Component({
  selector: 'app-dashboard-pagos',
  imports: [DecimalPipe],
  templateUrl: './dashboard-pagos.component.html',
  styleUrls: ['./dashboard-section.component.css', './dashboard-pagos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPagosComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly wallet = inject(EthereumWalletService);
  private readonly sepoliaTx = inject(SepoliaTransactionsService);

  /** Etiqueta única de red (p. ej. Ganache Local). */
  protected readonly networkName = environment.networkDisplayName;
  /** Explorador web con sufijo `/address/` para enlazar cuenta. */
  protected readonly showExplorer = Boolean(environment.explorerAddressUrl?.trim());
  /** Faucet externo (Sepolia); desactivado en red local. */
  protected readonly showFaucet = Boolean(environment.testnetFaucetUrl?.trim());

  private readonly authUser = toSignal(this.auth.user$, { initialValue: null as User | null });

  private txFetchGen = 0;
  private balFetchGen = 0;

  /** Saldo leído con MetaMask en la red configurada (solo sesión SIWE y red correcta). */
  protected readonly metaMaskBalanceEth = computed(() => this.wallet.balanceEthNumber());

  /** Saldo vía API (Blockscout) o JSON-RPC local según `environment`. */
  protected readonly readOnlyBalanceEth = signal<number | null>(null);
  protected readonly readOnlyBalanceLoading = signal(false);

  protected readonly normalizedProfileAddress = computed(() => {
    const raw = this.authUser()?.walletAddress?.trim();
    if (!raw || !/^0x[a-fA-F0-9]{40}$/i.test(raw)) {
      return null;
    }
    return raw.toLowerCase();
  });

  /**
   * Dirección on-chain a vigilar: MetaMask si hay cuenta, si no la del perfil.
   */
  protected readonly monitoredOnChainAddress = computed(() => {
    if (this.auth.isWalletSiweSession()) {
      const mm = this.wallet.connectedAddress();
      if (mm) {
        return mm.toLowerCase();
      }
    }
    return this.normalizedProfileAddress();
  });

  protected readonly displayEth = computed(() => {
    if (this.auth.isWalletSiweSession()) {
      const mm = this.metaMaskBalanceEth();
      if (mm !== null) {
        return mm;
      }
    }
    return this.readOnlyBalanceEth();
  });

  protected readonly networkChipLabel = computed(() => {
    if (!this.auth.isWalletSiweSession()) {
      return this.normalizedProfileAddress()
        ? `${this.networkName} · saldo e historial on-chain (sin MetaMask)`
        : `${this.networkName} · añade dirección en tu perfil para datos on-chain`;
    }
    if (!this.wallet.hasProvider()) {
      return 'Instala MetaMask';
    }
    if (!this.wallet.connectedAddress()) {
      return 'MetaMask · conecta desde el menú';
    }
    if (this.wallet.isTargetChain()) {
      return `${this.networkName} conectada`;
    }
    return `Wallet en otra red · cambia a ${this.networkName} en MetaMask`;
  });

  protected readonly networkChipTone = computed(() => {
    if (!this.auth.isWalletSiweSession()) {
      return this.normalizedProfileAddress() ? ('ok' as const) : ('muted' as const);
    }
    if (!this.wallet.hasProvider() || !this.wallet.connectedAddress()) {
      return 'muted' as const;
    }
    return this.wallet.isTargetChain() ? ('ok' as const) : ('warn' as const);
  });

  protected readonly transactions = signal<RecentChainTransaction[]>([]);
  protected readonly transactionsLoading = signal(false);
  protected readonly transactionsError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const addr = this.monitoredOnChainAddress();
      if (!addr) {
        this.txFetchGen += 1;
        this.transactions.set([]);
        this.transactionsLoading.set(false);
        this.transactionsError.set(null);
        return;
      }
      void this.refreshTransactions(addr);
    });

    effect(() => {
      const addr = this.monitoredOnChainAddress();
      const mmBal = this.metaMaskBalanceEth();
      if (!addr) {
        this.balFetchGen += 1;
        this.readOnlyBalanceEth.set(null);
        this.readOnlyBalanceLoading.set(false);
        return;
      }
      if (this.auth.isWalletSiweSession() && mmBal !== null) {
        this.balFetchGen += 1;
        this.readOnlyBalanceEth.set(null);
        this.readOnlyBalanceLoading.set(false);
        return;
      }
      void this.refreshReadOnlyBalance(addr);
    });
  }

  private async refreshTransactions(address: string): Promise<void> {
    const gen = ++this.txFetchGen;
    this.transactionsLoading.set(true);
    this.transactionsError.set(null);
    try {
      const list = await this.sepoliaTx.fetchRecentForAddress(address, 12);
      if (gen !== this.txFetchGen) {
        return;
      }
      this.transactions.set(list);
    } catch {
      if (gen !== this.txFetchGen) {
        return;
      }
      this.transactions.set([]);
      this.transactionsError.set('No se pudieron cargar las transacciones.');
    } finally {
      if (gen === this.txFetchGen) {
        this.transactionsLoading.set(false);
      }
    }
  }

  private async refreshReadOnlyBalance(address: string): Promise<void> {
    const gen = ++this.balFetchGen;
    this.readOnlyBalanceLoading.set(true);
    try {
      const wei = await this.sepoliaTx.fetchBalanceWeiForAddress(address);
      if (gen !== this.balFetchGen) {
        return;
      }
      if (wei === null) {
        this.readOnlyBalanceEth.set(null);
        return;
      }
      this.readOnlyBalanceEth.set(weiToEthNumber(wei));
    } catch {
      if (gen !== this.balFetchGen) {
        return;
      }
      this.readOnlyBalanceEth.set(null);
    } finally {
      if (gen === this.balFetchGen) {
        this.readOnlyBalanceLoading.set(false);
      }
    }
  }

  protected openAddressOnExplorer(): void {
    const addr = this.monitoredOnChainAddress();
    if (!addr) {
      return;
    }
    const base = environment.explorerAddressUrl?.trim();
    if (!base) {
      this.notify.toastInfo('No hay explorador web configurado para esta red.');
      return;
    }
    const url = `${base}${addr}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected goToEnviarDinero(): void {
    void this.router.navigateByUrl('/dashboard/enviar-dinero');
  }

  protected goToSubirPdf(): void {
    void this.router.navigateByUrl('/dashboard/subir-pdf');
  }

  protected async onFaucetClick(): Promise<void> {
    if (!this.showFaucet) {
      this.notify.toastInfo('En red local (Ganache) las cuentas ya tienen ETH de prueba; no se usa faucet externo.');
      return;
    }
    if (!this.auth.isWalletSiweSession()) {
      this.notify.toastInfo('El faucet solo está disponible si iniciaste sesión con MetaMask (SIWE).');
      return;
    }
    if (!this.wallet.hasProvider()) {
      this.notify.toastError('Instala MetaMask para usar el faucet de testnet.');
      return;
    }
    try {
      if (!this.wallet.connectedAddress()) {
        await this.wallet.connectMetaMask();
      } else {
        await this.wallet.ensureTargetChain();
      }
      await this.wallet.refreshBalance();
      this.wallet.openTestnetFaucet();
      this.notify.toastInfo('Red lista. En el faucet pega tu dirección y solicita ETH (puede pedirte iniciar sesión).');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo preparar la red ni abrir el faucet.';
      this.notify.toastError(msg);
    }
  }

  protected onSwapClick(): void {
    this.notify.toastInfo('Intercambio: integración DEX pendiente.');
  }
}

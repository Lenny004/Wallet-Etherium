import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { EthereumWalletService } from '../wallet/ethereum-wallet.service';
import { RecentChainTransaction, SepoliaTransactionsService } from '../wallet/sepolia-transactions.service';

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
  private fetchGen = 0;

  /** Saldo en ETH leído de MetaMask en Sepolia; `null` si no aplica. */
  protected readonly displayEth = computed(() => this.wallet.balanceEthNumber());

  protected readonly networkChipLabel = computed(() => {
    if (!this.auth.isWalletSiweSession()) {
      return 'Sepolia (testnet) · sin MetaMask en esta sesión';
    }
    if (!this.wallet.hasProvider()) {
      return 'Instala MetaMask';
    }
    if (!this.wallet.connectedAddress()) {
      return 'MetaMask · conecta desde el menú';
    }
    if (this.wallet.isTargetChain()) {
      return 'Sepolia conectada';
    }
    return 'Wallet en otra red · usa el faucet para cambiar a Sepolia';
  });

  protected readonly networkChipTone = computed(() => {
    if (!this.auth.isWalletSiweSession()) {
      return 'muted' as const;
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
      const addr = this.wallet.connectedAddress();
      const ok = this.wallet.isTargetChain();
      if (!addr || !ok) {
        this.fetchGen += 1;
        this.transactions.set([]);
        this.transactionsLoading.set(false);
        this.transactionsError.set(null);
        return;
      }
      void this.refreshTransactions(addr);
    });
  }

  private async refreshTransactions(address: string): Promise<void> {
    const gen = ++this.fetchGen;
    this.transactionsLoading.set(true);
    this.transactionsError.set(null);
    try {
      const list = await this.sepoliaTx.fetchRecentForAddress(address, 12);
      if (gen !== this.fetchGen) {
        return;
      }
      this.transactions.set(list);
    } catch {
      if (gen !== this.fetchGen) {
        return;
      }
      this.transactions.set([]);
      this.transactionsError.set('No se pudieron cargar las transacciones.');
    } finally {
      if (gen === this.fetchGen) {
        this.transactionsLoading.set(false);
      }
    }
  }

  protected openAddressOnExplorer(): void {
    const addr = this.wallet.connectedAddress();
    if (!addr || !this.wallet.isTargetChain()) {
      return;
    }
    const url = `${environment.sepoliaExplorerAddressUrl}${addr}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected goToEnviarDinero(): void {
    void this.router.navigateByUrl('/dashboard/enviar-dinero');
  }

  protected goToSubirPdf(): void {
    void this.router.navigateByUrl('/dashboard/subir-pdf');
  }

  protected async onFaucetClick(): Promise<void> {
    if (!this.auth.isWalletSiweSession()) {
      this.notify.toastInfo('El faucet en Sepolia solo está disponible si iniciaste sesión con MetaMask (SIWE).');
      return;
    }
    if (!this.wallet.hasProvider()) {
      this.notify.toastError('Instala MetaMask para solicitar ETH de prueba en Sepolia.');
      return;
    }
    try {
      if (!this.wallet.connectedAddress()) {
        await this.wallet.connectMetaMask();
      } else {
        await this.wallet.ensureTargetChain();
      }
      await this.wallet.refreshBalance();
      this.wallet.openSepoliaFaucet();
      this.notify.toastInfo(
        'Red Sepolia lista. En el faucet pega tu dirección y solicita ETH (puede pedirte iniciar sesión).'
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo preparar Sepolia ni abrir el faucet.';
      this.notify.toastError(msg);
    }
  }

  protected onSwapClick(): void {
    this.notify.toastInfo('Intercambio: integración DEX pendiente.');
  }
}

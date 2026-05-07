import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { EthereumWalletService } from '../wallet/ethereum-wallet.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  protected readonly wallet = inject(EthereumWalletService);

  protected readonly networkName = environment.networkDisplayName;

  protected readonly linkActive = { exact: true };

  ngOnInit(): void {
    if (this.auth.isWalletSiweSession()) {
      this.wallet.beginListening();
    }
  }

  protected async onWalletBarClick(): Promise<void> {
    if (this.wallet.shortAddress()) {
      try {
        await this.wallet.refreshChainAndBalance();
        this.notify.toastInfo('Saldo y red actualizados.');
      } catch {
        this.notify.toastError('No se pudo actualizar el estado de la wallet.');
      }
      return;
    }
    try {
      await this.wallet.connectMetaMask();
      this.notify.toastSuccess(`MetaMask conectada en ${this.networkName}.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo conectar la wallet.';
      this.notify.toastError(msg);
    }
  }

  protected async logout(): Promise<void> {
    const confirmed = await this.notify.confirm({
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a autenticarte para acceder al panel.',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) {
      return;
    }
    this.notify.toastInfo('Sesión cerrada');
    this.wallet.reset();
    this.auth.logout();
  }
}

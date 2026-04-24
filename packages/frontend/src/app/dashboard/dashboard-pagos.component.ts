import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../notifications/notification.service';

interface TransactionItem {
  type: 'sent' | 'faucet' | 'swap';
  title: string;
  subtitle: string;
  amount: string;
  status: 'confirmed' | 'pending';
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

  protected readonly balanceEth = signal(1.25);
  protected readonly balanceUsd = signal(2845.32);

  protected readonly transactions = signal<TransactionItem[]>([
    {
      type: 'sent',
      title: 'ETH enviado',
      subtitle: '0x71C...3a5f • Hoy, 2:45 PM',
      amount: '- 0.42 ETH',
      status: 'confirmed',
    },
    {
      type: 'faucet',
      title: 'Solicitud de faucet',
      subtitle: 'Puente Goerli • Ayer, 11:20 AM',
      amount: '+ 0.10 ETH',
      status: 'confirmed',
    },
    {
      type: 'swap',
      title: 'Intercambio de tokens',
      subtitle: 'Uniswap V3 • 24 oct, 2023',
      amount: '2.14 ETH',
      status: 'pending',
    },
  ]);

  protected goToEnviarDinero(): void {
    void this.router.navigateByUrl('/dashboard/enviar-dinero');
  }

  protected goToSubirPdf(): void {
    void this.router.navigateByUrl('/dashboard/subir-pdf');
  }

  protected onFaucetClick(): void {
    this.notify.toastInfo('Faucet: conecta la red de pruebas en una iteración futura.');
  }

  protected onSwapClick(): void {
    this.notify.toastInfo('Intercambio: integración DEX pendiente.');
  }
}

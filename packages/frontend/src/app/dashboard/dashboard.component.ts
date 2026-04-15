import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

interface TransactionItem {
  type: 'sent' | 'faucet' | 'swap';
  title: string;
  subtitle: string;
  amount: string;
  status: 'confirmed' | 'pending';
}

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
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
}

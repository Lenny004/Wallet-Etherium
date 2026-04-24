import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { EventSocketService } from '../blockchain/event-socket.service';

interface MoneyTransferResponse {
  transferId: string;
  status: string;
}

@Component({
  selector: 'app-enviar-dinero',
  imports: [FormsModule],
  templateUrl: './enviar-dinero.component.html',
  styleUrl: './enviar-dinero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnviarDineroComponent {
  private readonly http = inject(HttpClient);
  protected readonly events = inject(EventSocketService);

  protected readonly fromAddress = signal('0x0000000000000000000000000000000000000001');
  protected readonly toAddress = signal('0x0000000000000000000000000000000000000002');
  protected readonly amountEth = signal(0.1);
  protected readonly contractName = signal('WalletTransferContractV1');
  protected readonly transferId = signal('');
  protected readonly feedback = signal('');

  constructor() {
    this.events.connect();
  }

  protected requestTransfer(): void {
    this.http
      .post<MoneyTransferResponse>(`${environment.apiUrl}/enviar-dinero/request`, {
        fromAddress: this.fromAddress(),
        toAddress: this.toAddress(),
        amountEth: this.amountEth(),
        contractName: this.contractName()
      })
      .subscribe({
        next: (response) => {
          this.transferId.set(response.transferId);
          this.feedback.set('Transferencia solicitada. Sigue los eventos en tiempo real.');
        },
        error: (error: { error?: { message?: string } }) => {
          this.feedback.set(error.error?.message ?? 'No se pudo iniciar la transferencia.');
        }
      });
  }
}

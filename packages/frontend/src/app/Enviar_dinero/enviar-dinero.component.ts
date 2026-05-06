import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { EventSocketService } from '../blockchain/event-socket.service';
import { NotificationService } from '../notifications/notification.service';
import { AuthService } from '../auth/auth.service';

interface MoneyTransferResponse {
  transferId: string;
  status: string;
}

@Component({
  selector: 'app-enviar-dinero',
  imports: [FormsModule],
  templateUrl: './enviar-dinero.component.html',
  styleUrl: '../dashboard/dashboard-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnviarDineroComponent {
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthService);
  protected readonly events = inject(EventSocketService);

  protected readonly sessionUser = toSignal(this.auth.user$, { initialValue: null });
  protected readonly fromWalletDisplay = computed(
    () => this.sessionUser()?.walletAddress?.trim() || '— (inicia sesión o recarga el perfil)'
  );

  protected readonly toAddress = signal('');
  /** Texto libre; el backend valida con `parseEther` (hasta 18 decimales en notación estándar). */
  protected readonly amountEth = signal('0.1');
  protected readonly transferId = signal('');
  protected readonly feedback = signal('');

  constructor() {
    this.events.connect();
  }

  protected requestTransfer(): void {
    const wallet = this.sessionUser()?.walletAddress?.trim();
    if (!wallet) {
      const msg = 'No hay wallet en la sesión. Vuelve a iniciar sesión.';
      this.feedback.set(msg);
      this.notify.toastError(msg);
      return;
    }

    const amount = this.amountEth().trim();
    if (!amount) {
      const msg = 'Indica un monto en ETH.';
      this.feedback.set(msg);
      this.notify.toastError(msg);
      return;
    }

    this.http
      .post<MoneyTransferResponse>(`${environment.apiUrl}/enviar-dinero/request`, {
        toAddress: this.toAddress().trim(),
        amountEth: amount
      })
      .subscribe({
        next: (response) => {
          this.transferId.set(response.transferId);
          this.feedback.set('Transferencia solicitada. Sigue los eventos en tiempo real.');
          this.notify.toastSuccess('Transferencia solicitada. Revisa los eventos en vivo.');
        },
        error: (error: { status?: number; error?: { message?: string } }) => {
          const msg = error.error?.message ?? 'No se pudo iniciar la transferencia.';
          this.feedback.set(msg);
          this.notify.toastError(msg);
        }
      });
  }
}

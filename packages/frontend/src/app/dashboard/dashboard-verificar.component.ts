import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from '../notifications/notification.service';

@Component({
  selector: 'app-dashboard-verificar',
  imports: [FormsModule],
  templateUrl: './dashboard-verificar.component.html',
  styleUrl: './dashboard-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardVerificarComponent {
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly digest = signal('');
  protected readonly result = signal('');

  protected runVerification(): void {
    const value = this.digest().trim();
    if (!value) {
      this.notify.toastWarning('Introduce un hash o identificador para simular la verificación.');
      return;
    }
    this.result.set(
      'Verificación simulada: el backend puede extender este flujo con prueba on-chain o verificación de VC/DID.'
    );
    this.notify.toastSuccess('Comprobación registrada (demo).');
  }

  protected goToWalletCredentials(): void {
    void this.router.navigateByUrl('/wallet-credentials');
  }
}

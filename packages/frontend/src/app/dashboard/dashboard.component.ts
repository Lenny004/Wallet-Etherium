import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);

  protected readonly linkActive = { exact: true };

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
    this.authService.logout();
  }
}

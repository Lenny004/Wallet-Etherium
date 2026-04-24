import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

interface CertRow {
  name: string;
  issuer: string;
  status: 'activo' | 'revocado';
}

@Component({
  selector: 'app-dashboard-certificados',
  templateUrl: './dashboard-certificados.component.html',
  styleUrl: './dashboard-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardCertificadosComponent {
  private readonly router = inject(Router);

  protected readonly rows: CertRow[] = [
    { name: 'Verifiable Credential (registro)', issuer: 'Wallet-Etherium DID', status: 'activo' },
    { name: 'SIWE session binding', issuer: 'Dominio SIWE', status: 'activo' },
    { name: 'Certificado de tokenización (demo)', issuer: 'Módulo Subir PDF', status: 'activo' },
  ];

  protected goToCredentials(): void {
    void this.router.navigateByUrl('/wallet-credentials');
  }
}

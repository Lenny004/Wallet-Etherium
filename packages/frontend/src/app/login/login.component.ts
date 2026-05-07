import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { EthereumWalletService } from '../wallet/ethereum-wallet.service';

type LoginTab = 'vault' | 'identity' | 'siwe';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  /** chainId configurado (debe coincidir con el backend `SIWE_CHAIN_ID`). */
  protected readonly chainId = environment.chainId;
  /** Etiqueta de red en UI (p. ej. Ganache Local). */
  protected readonly networkName = environment.networkDisplayName;
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly wallet = inject(EthereumWalletService);

  readonly activeTab = signal<LoginTab>('vault');
  error = '';
  siweLoading = false;

  readonly vaultForm = this.formBuilder.group({
    walletAddress: ['', [Validators.required]],
    seedPhrase: ['', [Validators.required, Validators.minLength(20)]],
  });

  readonly formVc = this.formBuilder.group({
    did: ['', [Validators.required, Validators.pattern(/^did:ethr:0x[a-fA-F0-9]{40}$/)]],
    credential: ['', [Validators.required, Validators.minLength(50)]],
  });

  get hasWallet(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean((window as { ethereum?: unknown }).ethereum);
  }

  setTab(tab: LoginTab): void {
    this.activeTab.set(tab);
    this.error = '';
  }

  submitVault(): void {
    this.error = '';
    if (this.vaultForm.invalid) {
      this.vaultForm.markAllAsTouched();
      return;
    }

    const { walletAddress, seedPhrase } = this.vaultForm.getRawValue();
    if (!walletAddress || !seedPhrase) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    this.auth.login(walletAddress, seedPhrase).subscribe({
      next: () => {
        this.notify.toastSuccess('Sesión iniciada correctamente.');
        void this.router.navigateByUrl('/dashboard');
      },
      error: (errorResponse: { error?: { message?: string } }) => {
        this.error = '';
        this.notify.toastError(errorResponse?.error?.message ?? 'Error de autenticación.');
      },
    });
  }

  submitVc(): void {
    this.error = '';
    if (this.formVc.invalid) {
      this.formVc.markAllAsTouched();
      return;
    }

    const { did, credential } = this.formVc.getRawValue();
    if (!did || !credential) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    let vcPayload: string | object = credential.trim();
    try {
      vcPayload = JSON.parse(vcPayload) as object;
    } catch {
      vcPayload = credential.trim();
    }

    this.auth.loginWithVc(did, vcPayload).subscribe({
      next: () => {
        this.notify.toastSuccess('Credencial verificada. Bienvenido.');
        void this.router.navigateByUrl('/dashboard');
      },
      error: (errorResponse: { error?: { message?: string } }) => {
        this.error = '';
        this.notify.toastError(errorResponse?.error?.message ?? 'No se pudo verificar la credencial.');
      },
    });
  }

  loginSiwe(): void {
    this.error = '';
    this.siweLoading = true;

    this.auth.loginWithSiwe().subscribe({
      next: () => {
        this.wallet.beginListening();
        void (async () => {
          try {
            await this.wallet.ensureTargetChain();
            await this.wallet.refreshChainAndBalance();
          } catch {
            this.notify.toastInfo(`Acepta el cambio a ${environment.networkDisplayName} en MetaMask para operar en esa red.`);
          } finally {
            this.siweLoading = false;
          }
          this.notify.toastSuccess('Conectado con tu wallet.');
          void this.router.navigateByUrl('/dashboard');
        })();
      },
      error: (errorResponse: { error?: { message?: string }; message?: string; status?: number }) => {
        this.error = '';
        let message = 'Error al iniciar sesión con wallet.';
        if (errorResponse?.error?.message) {
          message = errorResponse.error.message;
        } else if (typeof errorResponse?.message === 'string') {
          message = errorResponse.message;
        } else if (errorResponse?.status === 0) {
          message = 'No se pudo conectar con el backend.';
        }
        this.notify.toastError(message);
        this.siweLoading = false;
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.vaultForm.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  hasErrorVc(field: string, errorType: string): boolean {
    const control = this.formVc.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  hasErrorMinLength(field: string): boolean {
    const control = this.vaultForm.get(field);
    return Boolean(control?.hasError('minlength') && control?.touched);
  }
}

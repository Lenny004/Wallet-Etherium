import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  error = '';
  useVcLogin = false;
  siweLoading = false;

  readonly form = this.formBuilder.group({
    walletAddress: ['', [Validators.required]],
    seedPhrase: ['', [Validators.required, Validators.minLength(20)]],
  });

  readonly formVc = this.formBuilder.group({
    did: ['', [Validators.required, Validators.pattern(/^did:ethr:0x[a-fA-F0-9]{40}$/)]],
    vc: ['', [Validators.required, Validators.minLength(50)]],
  });

  get hasWallet(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean((window as { ethereum?: unknown }).ethereum);
  }

  setLoginMode(useVc: boolean): void {
    this.useVcLogin = useVc;
    this.error = '';
  }

  onSubmit(): void {
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { walletAddress, seedPhrase } = this.form.getRawValue();
    if (!walletAddress || !seedPhrase) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    this.auth.login(walletAddress, seedPhrase).subscribe({
      next: () => {
        void this.router.navigateByUrl('/dashboard');
      },
      error: (errorResponse: { error?: { message?: string } }) => {
        this.error = errorResponse?.error?.message ?? 'Error de autenticación.';
      },
    });
  }

  onSubmitVc(): void {
    this.error = '';
    if (this.formVc.invalid) {
      this.formVc.markAllAsTouched();
      return;
    }

    const { did, vc } = this.formVc.getRawValue();
    if (!did || !vc) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    let vcPayload: string | object = vc.trim();
    try {
      vcPayload = JSON.parse(vcPayload) as object;
    } catch {
      vcPayload = vc.trim();
    }

    this.auth.loginWithVc(did, vcPayload).subscribe({
      next: () => {
        void this.router.navigateByUrl('/dashboard');
      },
      error: (errorResponse: { error?: { message?: string } }) => {
        this.error = errorResponse?.error?.message ?? 'No se pudo verificar la credencial.';
      },
    });
  }

  onLoginWithSiwe(): void {
    this.error = '';
    this.siweLoading = true;

    this.auth.loginWithSiwe().subscribe({
      next: () => {
        void this.router.navigateByUrl('/dashboard');
      },
      error: (errorResponse: { error?: { message?: string }; message?: string; status?: number }) => {
        if (errorResponse?.error?.message) {
          this.error = errorResponse.error.message;
        } else if (errorResponse?.message) {
          this.error = errorResponse.message;
        } else if (errorResponse?.status === 0) {
          this.error = 'No se pudo conectar con el backend.';
        } else {
          this.error = 'Error al iniciar sesión con wallet.';
        }
        this.siweLoading = false;
      },
      complete: () => {
        this.siweLoading = false;
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.form.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  hasErrorVc(field: string, errorType: string): boolean {
    const control = this.formVc.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  hasErrorMinLength(field: string): boolean {
    const control = this.form.get(field);
    return Boolean(control?.hasError('minlength') && control?.touched);
  }
}

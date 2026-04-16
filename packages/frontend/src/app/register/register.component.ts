import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly credentialsStorageKey = 'wallet_credentials';

  error = '';
  loading = false;

  readonly registerForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    role: ['', [Validators.required]],
    company: ['', [Validators.required]],
  });

  submitRegister(): void {
    if (this.loading) {
      return;
    }

    this.error = '';
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { fullName, role, company } = this.registerForm.getRawValue();
    if (!fullName || !role || !company) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    const { nombre, apellido } = this.splitFullName(fullName);
    if (!nombre || !apellido) {
      this.error = 'Ingresa nombre y apellido.';
      return;
    }

    this.loading = true;

    this.auth.register(nombre, apellido, role, company).subscribe({
      next: (response) => {
        const credentials = {
          walletAddress: response.walletAddress,
          seedPhrase: response.seedPhrase,
          did: response.did,
        };

        sessionStorage.setItem(this.credentialsStorageKey, JSON.stringify(credentials));

        void this.router.navigate(['/wallet-credentials'], {
          state: credentials,
        });

        this.loading = false;
      },
      error: (errorResponse: { status?: number; error?: { message?: string } }) => {
        this.loading = false;
        if (errorResponse?.status === 0) {
          this.error = 'No se pudo conectar al backend. Verifica que esté corriendo en http://localhost:3000.';
          return;
        }

        this.error = errorResponse?.error?.message ?? 'Error al registrarse.';
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.registerForm.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  private splitFullName(fullName: string): { nombre: string; apellido: string } {
    const normalized = fullName.trim().replace(/\s+/g, ' ');
    const parts = normalized.split(' ');

    if (parts.length < 2) {
      return { nombre: '', apellido: '' };
    }

    const nombre = parts[0];
    const apellido = parts.slice(1).join(' ');
    return { nombre, apellido };
  }
}

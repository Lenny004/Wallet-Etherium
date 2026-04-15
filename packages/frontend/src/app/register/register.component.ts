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

  error = '';

  readonly form = this.formBuilder.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    rol: ['', [Validators.required]],
    compania: ['', [Validators.required]],
  });

  onSubmit(): void {
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, apellido, rol, compania } = this.form.getRawValue();
    if (!nombre || !apellido || !rol || !compania) {
      this.error = 'Completa todos los campos requeridos.';
      return;
    }

    this.auth.register(nombre, apellido, rol, compania).subscribe({
      next: (response) => {
        void this.router.navigate(['/wallet-credentials'], {
          state: {
            walletAddress: response.walletAddress,
            seedPhrase: response.seedPhrase,
            did: response.did,
          },
        });
      },
      error: (errorResponse: { error?: { message?: string } }) => {
        this.error = errorResponse?.error?.message ?? 'Error al registrarse.';
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.form.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }
}

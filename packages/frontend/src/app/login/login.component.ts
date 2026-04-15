import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

type LoginTab = 'vault' | 'identity' | 'siwe';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly formBuilder = new FormBuilder();
  private readonly router = inject(Router);

  protected readonly activeTab = signal<LoginTab>('vault');

  protected readonly vaultForm = this.formBuilder.group({
    walletAddress: ['', [Validators.required]],
    seedPhrase: ['', [Validators.required, Validators.minLength(20)]],
  });

  protected readonly vcForm = this.formBuilder.group({
    did: ['', [Validators.required]],
    credential: ['', [Validators.required]],
  });

  protected setTab(tab: LoginTab): void {
    this.activeTab.set(tab);
  }

  protected submitVault(): void {
    if (this.vaultForm.invalid) {
      this.vaultForm.markAllAsTouched();
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }

  protected submitVc(): void {
    if (this.vcForm.invalid) {
      this.vcForm.markAllAsTouched();
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }

  protected loginSiwe(): void {
    this.router.navigateByUrl('/dashboard');
  }
}

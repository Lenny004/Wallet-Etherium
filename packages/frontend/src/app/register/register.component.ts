import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly formBuilder = new FormBuilder();
  private readonly router = inject(Router);

  protected readonly registerForm = this.formBuilder.group({
    fullName: ['', [Validators.required]],
    role: ['', [Validators.required]],
    company: ['', [Validators.required]],
  });

  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.router.navigateByUrl('/login');
  }
}

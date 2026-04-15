import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [],
})
export class App {
  private readonly auth = inject(AuthService);

  constructor() {
    this.auth.loadMe();
  }
}

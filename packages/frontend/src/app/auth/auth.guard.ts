import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard de rutas protegidas.
 *
 * Permite continuar solo cuando existe sesión activa;
 * en caso contrario redirige al flujo de login.
 *
 * @returns `true` si el usuario está autenticado o `UrlTree` hacia `/login`.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.parseUrl('/login');
};
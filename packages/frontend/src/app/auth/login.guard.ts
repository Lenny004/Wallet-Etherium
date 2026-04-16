import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard inverso para rutas públicas de autenticación.
 *
 * Permite el acceso al login solo si no hay sesión activa;
 * si el usuario ya está autenticado, redirige al dashboard.
 *
 * @returns `true` cuando no hay sesión o `UrlTree` hacia `/dashboard`.
 */
export const loginGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.parseUrl('/dashboard');
};
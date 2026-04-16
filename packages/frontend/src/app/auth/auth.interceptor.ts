import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Interceptor de autenticación para solicitudes HTTP salientes.
 *
 * Adjunta el header `Authorization: Bearer <token>` cuando existe
 * un token activo en el servicio de autenticación.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  // Token de sesión actual; si no existe, la petición continúa sin modificación.
  const token = auth.token;

  if (!token) {
    return next(request);
  }

  // Clona la request para preservar inmutabilidad del objeto original.
  const authRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authRequest);
};
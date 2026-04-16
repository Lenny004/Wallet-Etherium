import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  nombre?: string;
  apellido?: string;
  rol?: string;
  compania?: string;
  walletAddress?: string;
  did?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  user: User;
  walletAddress: string;
  seedPhrase: string;
  did: string;
  vc: string;
}

interface SiweMessageResponse {
  message: string;
  nonce: string;
}

/**
 * Servicio central de autenticación del frontend.
 *
 * Responsabilidades:
 * - Gestionar login por seed phrase, VC y SIWE.
 * - Mantener estado reactivo del usuario autenticado.
 * - Persistir/limpiar token JWT en almacenamiento local.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Cliente HTTP para consumir endpoints de autenticación. */
  private readonly http = inject(HttpClient);
  /** Router para redirecciones post login/logout. */
  private readonly router = inject(Router);
  /** Clave única usada para almacenar el JWT en localStorage. */
  private readonly tokenKey = 'auth_token';

  /** Estado reactivo del usuario autenticado para toda la app. */
  readonly user$ = new BehaviorSubject<User | null>(null);

  /**
   * Obtiene el token JWT almacenado en localStorage.
   *
   * @returns Token JWT actual o `null` si no existe sesión persistida.
   */
  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Indica si existe una sesión activa en cliente.
   *
   * @returns `true` cuando hay token persistido; en caso contrario `false`.
   */
  isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  /**
   * Inicia sesión con wallet y seed phrase.
   *
   * @param walletAddress Dirección pública de la wallet del usuario.
   * @param seedPhrase Frase semilla en texto plano para validación en backend.
   * @returns Observable con token y usuario autenticado.
   */
  login(walletAddress: string, seedPhrase: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { walletAddress, seedPhrase })
      .pipe(tap((response) => this.setSession(response.token, response.user)));
  }

  /**
   * Inicia sesión validando DID y credencial verificable.
   *
   * @param did Identificador descentralizado asociado al usuario.
   * @param vc Credencial verificable en formato string o JSON serializable.
   * @returns Observable con token y usuario autenticado.
   */
  loginWithVc(did: string, vc: string | object): Observable<LoginResponse> {
    // Normaliza la VC para enviar siempre un payload textual estable al backend.
    const vcPayload = typeof vc === 'string' ? vc : JSON.stringify(vc);
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login-vc`, { did, vc: vcPayload })
      .pipe(tap((response) => this.setSession(response.token, response.user)));
  }

  /**
   * Ejecuta flujo SIWE (Sign-In With Ethereum) para autenticar por firma.
   *
   * Flujo:
   * 1) Solicita cuentas a la wallet inyectada.
   * 2) Solicita mensaje SIWE al backend.
   * 3) Firma el mensaje en cliente.
   * 4) Envía firma para validación y creación de sesión.
   *
   * @returns Observable con token y usuario autenticado.
   */
  loginWithSiwe(): Observable<LoginResponse> {
    // Referencia segura al objeto global para evitar errores en entornos sin `window`.
    const win = typeof window !== 'undefined' ? window : null;
    // Proveedor EIP-1193 inyectado por extensiones tipo MetaMask.
    const eth = win && (win as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

    if (!eth) {
      return new Observable((observer) => {
        observer.error(new Error('No se detectó wallet inyectada compatible con SIWE.'));
      });
    }

    return new Observable<string[]>((observer) => {
      eth
        .request({ method: 'eth_requestAccounts' })
        .then((result) => observer.next(result as string[]))
        .catch((error) => observer.error(error));
    }).pipe(
      switchMap((accounts) => {
        // SIWE usa la primera cuenta seleccionada por la wallet.
        const address = accounts?.[0];
        if (!address) {
          throw new Error('No se obtuvo dirección de la wallet.');
        }

        return this.http
          .get<SiweMessageResponse>(`${environment.apiUrl}/auth/siwe-message`, { params: { address } })
          .pipe(
            switchMap(({ message }) =>
              new Observable<string>((observer) => {
                eth
                  .request({ method: 'personal_sign', params: [message, address] })
                  .then((signature) => observer.next(signature as string))
                  .catch((error) => observer.error(error));
              }).pipe(
                switchMap((signature) =>
                  this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login-siwe`, {
                    message,
                    signature
                  })
                )
              )
            )
          );
      }),
      tap((response) => this.setSession(response.token, response.user))
    );
  }

  /**
   * Registra un nuevo usuario y genera identidad inicial.
    *
    * @param nombre Nombre del usuario.
    * @param apellido Apellido del usuario.
    * @param rol Rol de negocio asociado al perfil.
    * @param compania Nombre de la compañía del usuario.
    * @returns Observable con datos de usuario y credenciales iniciales generadas.
   */
  register(nombre: string, apellido: string, rol: string, compania: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, {
      nombre,
      apellido,
      rol,
      compania
    });
  }

  /**
   * Carga el perfil del usuario autenticado desde el backend.
    *
    * Si no hay token, limpia estado local y evita la petición HTTP.
   */
  loadMe(): void {
    if (!this.token) {
      this.user$.next(null);
      return;
    }

    this.http.get<User>(`${environment.apiUrl}/me`).subscribe({
      next: (user) => this.user$.next(user),
      error: () => this.logout(false)
    });
  }

  /**
   * Cierra la sesión local y redirige opcionalmente al login.
    *
    * @param redirect Cuando es `true`, navega automáticamente a `/login`.
   */
  logout(redirect = true): void {
    localStorage.removeItem(this.tokenKey);
    this.user$.next(null);
    if (redirect) {
      void this.router.navigateByUrl('/login');
    }
  }

  /**
   * Persiste el token y publica el usuario autenticado en estado local.
    *
    * @param token JWT emitido por el backend.
    * @param user Perfil público del usuario autenticado.
   */
  private setSession(token: string, user: User): void {
    localStorage.setItem(this.tokenKey, token);
    this.user$.next(user);
  }
}
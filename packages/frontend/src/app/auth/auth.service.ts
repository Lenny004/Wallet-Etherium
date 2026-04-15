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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenKey = 'auth_token';

  readonly user$ = new BehaviorSubject<User | null>(null);

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  login(walletAddress: string, seedPhrase: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { walletAddress, seedPhrase })
      .pipe(tap((response) => this.setSession(response.token, response.user)));
  }

  loginWithVc(did: string, vc: string | object): Observable<LoginResponse> {
    const vcPayload = typeof vc === 'string' ? vc : JSON.stringify(vc);
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login-vc`, { did, vc: vcPayload })
      .pipe(tap((response) => this.setSession(response.token, response.user)));
  }

  loginWithSiwe(): Observable<LoginResponse> {
    const win = typeof window !== 'undefined' ? window : null;
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

  register(nombre: string, apellido: string, rol: string, compania: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, {
      nombre,
      apellido,
      rol,
      compania
    });
  }

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

  logout(redirect = true): void {
    localStorage.removeItem(this.tokenKey);
    this.user$.next(null);
    if (redirect) {
      void this.router.navigateByUrl('/login');
    }
  }

  private setSession(token: string, user: User): void {
    localStorage.setItem(this.tokenKey, token);
    this.user$.next(user);
  }
}
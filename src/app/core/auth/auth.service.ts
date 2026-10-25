import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, switchMap, tap } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';
import { AccessTokenResponse, Me, PortalMembership } from './auth.models';

/**
 * Holds the session. The access token lives only in memory; the refresh token is an HttpOnly cookie
 * (`py_refresh`) the browser sends to /api/auth/refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(null);
  private readonly currentUser = signal<Me | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly accessToken = this.token.asReadonly();
  readonly me = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  login(email: string, password: string): Observable<Me> {
    return this.http
      .post<AppResponse<AccessTokenResponse>>('/api/auth/login', { email, password })
      .pipe(
        unwrap(),
        tap((res) => this.token.set(res.accessToken)),
        switchMap(() => this.loadMe()),
      );
  }

  /**
   * Rotates the refresh cookie and returns a new access token. Concurrent callers share one request:
   * the backend treats a reused refresh token as theft and revokes the session.
   */
  refresh(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http
        .post<AppResponse<AccessTokenResponse>>('/api/auth/refresh', null)
        .pipe(
          unwrap(),
          map((res) => res.accessToken),
          tap({
            next: (accessToken) => this.token.set(accessToken),
            error: () => this.clear(),
          }),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay(1),
        );
    }
    return this.refreshInFlight;
  }

  loadMe(): Observable<Me> {
    return this.http.get<AppResponse<Me>>('/api/me').pipe(
      unwrap(),
      tap((me) => this.currentUser.set(me)),
    );
  }

  /** Called once on app start: a valid refresh cookie silently signs the user back in. */
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        switchMap(() => this.loadMe()),
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  logout(): Observable<void> {
    return this.http.post<AppResponse<void>>('/api/auth/logout', null).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.clear()),
    );
  }

  clear(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }

  /** Where a signed-in user should land: create a portal, go straight in, or pick one. */
  landingUrl(portals: PortalMembership[] = this.currentUser()?.portals ?? []): string {
    if (portals.length === 0) {
      return '/portals/new';
    }
    return portals.length === 1 ? `/p/${portals[0].slug}` : '/portals';
  }
}


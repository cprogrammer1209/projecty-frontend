import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { CurrentPortal, PortalApi } from './portal.api';

/**
 * The portal the user is working in, taken from the URL (/p/{slug}). Its id goes out as X-Portal-Id on every
 * API call; the server checks it against the token (PTL-US-04).
 */
@Injectable({ providedIn: 'root' })
export class ActivePortalService {
  private readonly auth = inject(AuthService);
  private readonly portalApi = inject(PortalApi);

  private readonly current = signal<CurrentPortal | null>(null);
  private readonly activeId = signal<string | null>(null);

  readonly portal = this.current.asReadonly();
  readonly portalId = this.activeId.asReadonly();
  /** User's own time zone, else the portal's (PTL-BR-05). */
  readonly timeZone = computed(() => this.auth.me()?.timeZone ?? this.current()?.timeZone ?? 'UTC');

  constructor() {
    // Signing out (or ending a support session) must not leave the old portal on later requests.
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        untracked(() => this.clear());
      }
    });
  }

  /**
   * Switches to the portal with this slug. Everything from the previous portal is dropped first, so nothing
   * of it shows while the new one loads (PTL-US-03). Emits false if the user isn't a member.
   */
  activate(slug: string): Observable<boolean> {
    if (this.current()?.slug === slug) {
      return of(true);
    }
    this.clear();
    const membership = this.auth.me()?.portals.find((p) => p.slug === slug);
    if (!membership) {
      return of(false);
    }
    this.activeId.set(membership.id);
    return this.portalApi.current().pipe(
      tap((portal) => this.current.set(portal)),
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  /** After the settings were saved. */
  update(portal: CurrentPortal): void {
    this.current.set(portal);
  }

  clear(): void {
    this.current.set(null);
    this.activeId.set(null);
  }
}

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { MemberApi, MyMembership, Permission } from '../member/member.api';
import { CurrentPortal, PortalApi } from './portal.api';

/**
 * The portal the user is working in, taken from the URL (/p/{slug}). Its id goes out as X-Portal-Id on every
 * API call; the server checks it against the token (PTL-US-04).
 */
/** Why a portal couldn't be opened: never a member, or removed (it's in my list but the server refuses). */
export type ActivationResult = 'ok' | 'not-member' | 'removed';

@Injectable({ providedIn: 'root' })
export class ActivePortalService {
  private readonly auth = inject(AuthService);
  private readonly portalApi = inject(PortalApi);
  private readonly memberApi = inject(MemberApi);

  private readonly current = signal<CurrentPortal | null>(null);
  private readonly mine = signal<MyMembership | null>(null);
  private readonly activeId = signal<string | null>(null);

  readonly portal = this.current.asReadonly();
  readonly portalId = this.activeId.asReadonly();
  /** My profile and permissions in this portal (USR-US-06). */
  readonly membership = this.mine.asReadonly();
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
   * of it shows while the new one loads (PTL-US-03).
   */
  activate(slug: string): Observable<ActivationResult> {
    if (this.current()?.slug === slug) {
      return of('ok');
    }
    this.clear();
    const membership = this.auth.me()?.portals.find((p) => p.slug === slug);
    if (!membership) {
      return of('not-member');
    }
    this.activeId.set(membership.id);
    return forkJoin([this.portalApi.current(), this.memberApi.me()]).pipe(
      tap(([portal, membership]) => {
        this.current.set(portal);
        this.mine.set(membership);
      }),
      map((): ActivationResult => 'ok'),
      catchError(() => {
        this.clear();
        return of<ActivationResult>('removed');
      }),
    );
  }

  /** Whether my profile here grants the permission; the server checks it again on every call. */
  can(permission: Permission): boolean {
    return this.mine()?.permissions.includes(permission) ?? false;
  }

  /** After the settings were saved. */
  update(portal: CurrentPortal): void {
    this.current.set(portal);
  }

  clear(): void {
    this.current.set(null);
    this.mine.set(null);
    this.activeId.set(null);
  }
}

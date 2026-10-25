import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Logo } from '../../../shared/ui/logo/logo';

/** Stand-in for the portal home (built in a later slice). Proves sign-in landed in the right portal. */
@Component({
  selector: 'py-placeholder-home',
  imports: [RouterLink, Logo],
  template: `
    <header class="top">
      <py-logo />
      <button class="py-btn py-btn--ghost" type="button" (click)="signOut()">Sign out</button>
    </header>
    <main class="main">
      @if (portal(); as p) {
        <h1 class="py-title">Welcome to {{ p.name }}</h1>
        <p class="py-body muted">Signed in as {{ auth.me()?.email }} · {{ p.slug }}.projecty.app</p>
        <p class="py-body muted">The portal home arrives in a later slice.</p>
        @if ((auth.me()?.portals?.length ?? 0) > 1) {
          <a routerLink="/portals">Switch portal</a>
        }
      } @else {
        <h1 class="py-title">Portal not found</h1>
        <p class="py-body muted">You're not a member of "{{ slug() }}".</p>
        <a [routerLink]="auth.landingUrl()">Go to your portals</a>
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .top { display: flex; align-items: center; justify-content: space-between; padding: var(--py-space-4) var(--py-space-6); border-bottom: 1px solid var(--py-border); }
    .main { max-width: 640px; margin: 0 auto; padding: var(--py-space-8) var(--py-space-4); display: flex; flex-direction: column; gap: var(--py-space-2); }
    .muted { color: var(--py-ink-muted); }
  `,
})
export class PlaceholderHome {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the route (withComponentInputBinding). */
  readonly slug = input.required<string>();
  protected readonly portal = computed(() => this.auth.me()?.portals.find((p) => p.slug === this.slug()));

  protected signOut(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/sign-in'));
  }
}

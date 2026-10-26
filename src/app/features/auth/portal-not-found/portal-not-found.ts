import { Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

/**
 * A /p/{slug} the user can't use: never a member (says nothing about whether it exists, PTL-US-04), or
 * deactivated while using it (?reason=removed).
 */
@Component({
  selector: 'py-portal-not-found',
  imports: [RouterLink],
  template: `
    <section aria-labelledby="pnf-title">
      <div class="py-view-head">
        @if (reason() === 'removed') {
          <h1 class="py-title" id="pnf-title">You no longer have access</h1>
          <p class="py-body">An admin of this portal removed your access. Your other portals still work.</p>
        } @else {
          <h1 class="py-title" id="pnf-title">Portal not found</h1>
          <p class="py-body">This portal doesn't exist, or you're not a member of it.</p>
        }
      </div>
      <a class="py-btn py-btn--primary py-btn--block" [routerLink]="auth.landingUrl()">Go to your portals</a>
    </section>
  `,
})
export class PortalNotFound implements OnInit {
  protected readonly auth = inject(AuthService);
  readonly reason = input<string>();

  ngOnInit(): void {
    // Refresh the portal list so a portal we lost access to drops out of it.
    this.auth.loadMe().subscribe({ error: () => {} });
  }
}

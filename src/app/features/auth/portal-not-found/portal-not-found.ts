import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

/** A /p/{slug} the user isn't a member of; says nothing about whether it exists (PTL-US-04). */
@Component({
  selector: 'py-portal-not-found',
  imports: [RouterLink],
  template: `
    <section aria-labelledby="pnf-title">
      <div class="py-view-head">
        <h1 class="py-title" id="pnf-title">Portal not found</h1>
        <p class="py-body">This portal doesn't exist, or you're not a member of it.</p>
      </div>
      <a class="py-btn py-btn--primary py-btn--block" [routerLink]="auth.landingUrl()">Go to your portals</a>
    </section>
  `,
})
export class PortalNotFound {
  protected readonly auth = inject(AuthService);
}

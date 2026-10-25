import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { Icon } from '../../../shared/ui/icon/icon';

/** Landing page for the admin console's "sign in as" link: /impersonate?code=... */
@Component({
  selector: 'py-impersonation-launch',
  imports: [Icon],
  template: `
    <section aria-labelledby="launch-title" aria-live="polite">
      @if (error(); as message) {
        <div class="py-view-head">
          <h1 class="py-title" id="launch-title">This support link has expired</h1>
          <p class="py-body">Support links work once, for two minutes. Start a new session from the admin console.</p>
        </div>
        <div class="py-alert" role="alert"><py-icon name="alert" /><span>{{ message }}</span></div>
      } @else {
        <div class="py-view-head">
          <h1 class="py-title" id="launch-title">Starting support session…</h1>
          <p class="py-body">This takes a second.</p>
        </div>
      }
    </section>
  `,
})
export class ImpersonationLaunch implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the query string (withComponentInputBinding). */
  readonly code = input<string>();

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const code = this.code();
    if (!code) {
      this.error.set('The link is missing its code.');
      return;
    }
    this.auth.redeemImpersonation(code).subscribe({
      next: (me) => this.router.navigateByUrl(this.auth.landingUrl(me.portals), { replaceUrl: true }),
      error: (err: ApiError) => this.error.set(err.message),
    });
  }
}

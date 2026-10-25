import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

/** Shown on every page while a platform admin is signed in as this user. */
@Component({
  selector: 'py-impersonation-banner',
  imports: [DatePipe],
  template: `
    @if (auth.impersonation(); as imp) {
      <div class="banner" role="status">
        <span class="banner__tag">Support session</span>
        <span class="banner__text">
          Signed in as <strong>{{ auth.me()?.fullName ?? auth.me()?.email }}</strong> by {{ imp.adminName }}
          · ends {{ imp.expiresAt | date: 'shortTime' }}
        </span>
        <button class="banner__end" type="button" [disabled]="ending()" (click)="end()">End session</button>
      </div>
    }
  `,
  styles: `
    .banner {
      display: flex; align-items: center; gap: var(--py-space-3); flex-wrap: wrap;
      padding: var(--py-space-2) var(--py-space-4);
      background: var(--py-accent); color: var(--py-on-accent);
      font: 500 13px/18px var(--py-font-ui);
    }
    .banner__tag { font-weight: 600; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; }
    .banner__text { flex: 1; min-width: 0; }
    .banner__end {
      height: var(--py-control-h-compact); padding: 0 var(--py-space-3); cursor: pointer;
      border: 1px solid var(--py-on-accent); border-radius: var(--py-radius-md);
      background: transparent; color: var(--py-on-accent); font: 500 12px/16px var(--py-font-ui);
    }
    .banner__end:hover { background: rgba(20, 22, 26, .08); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonationBanner {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly ending = signal(false);

  protected end(): void {
    this.ending.set(true);
    this.auth.endImpersonation().subscribe(() => {
      this.ending.set(false);
      this.router.navigateByUrl('/support-session-ended');
    });
  }
}

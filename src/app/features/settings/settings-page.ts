import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ActivePortalService } from '../../core/portal/active-portal.service';

/** Settings: the portal's (PTL-US-02) and the user's own (PTL-US-12). */
@Component({
  selector: 'py-settings-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="head">
      <h1>Settings</h1>
      <p>{{ active.portal()?.name }}: regional settings, people, and your own preferences.</p>
    </div>
    <nav class="tabs" aria-label="Settings sections">
      <a [routerLink]="['/p', active.portal()?.slug, 'settings', 'portal']" routerLinkActive="active">Portal</a>
      @if (active.can('USERS_VIEW')) {
        <a [routerLink]="['/p', active.portal()?.slug, 'settings', 'users']" routerLinkActive="active">Users</a>
      }
      <a [routerLink]="['/p', active.portal()?.slug, 'settings', 'preferences']" routerLinkActive="active">My preferences</a>
    </nav>
    <router-outlet />
  `,
  styles: `
    .head h1 { font: 600 24px/1.2 var(--py-font-ui); letter-spacing: -.03em; margin: 0; }
    .head p { margin: 6px 0 0; color: var(--py-ink-muted); font-size: 13px; }
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--py-border); margin: 20px 0; }
    .tabs a { padding: 10px 12px; margin-bottom: -1px; border-bottom: 2px solid transparent; color: var(--py-ink-muted); font-size: 13px; text-decoration: none; }
    .tabs a.active { border-bottom-color: var(--py-brand); color: var(--py-brand); font-weight: 600; }
  `,
})
export class SettingsPage {
  protected readonly active = inject(ActivePortalService);
}

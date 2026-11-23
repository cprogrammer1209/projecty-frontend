import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActivePortalService } from '../../core/portal/active-portal.service';

/** The tab strip of a project: Overview and Tasks (Tasks needs TASKS_VIEW). */
@Component({
  selector: 'py-project-tabs',
  imports: [RouterLink],
  template: `
    <nav class="ptabs" aria-label="Project sections">
      <a [routerLink]="['/p', active.portal()?.slug, 'projects', projectId()]" [class.active]="current() === 'overview'" id="tab-overview">Overview</a>
      @if (active.can('TASKS_VIEW')) {
        <a [routerLink]="['/p', active.portal()?.slug, 'projects', projectId(), 'tasks']" [class.active]="current() === 'tasks'" id="tab-tasks">
          Tasks@if (count() !== null) { <span class="tab-count">{{ count() }}</span> }
        </a>
      }
    </nav>
  `,
  styles: `
    .ptabs { display: flex; gap: 4px; border-bottom: 1px solid var(--py-border); }
    a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; color: var(--py-ink-muted); font: 500 13px/18px var(--py-font-ui); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    a:hover { color: var(--py-ink); text-decoration: none; }
    a.active { color: var(--py-ink); border-bottom-color: var(--py-brand); }
    .tab-count { font: 500 11px/16px var(--py-font-ui); padding: 0 6px; border-radius: 99px; background: var(--py-surface-2); color: var(--py-ink-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabs {
  readonly projectId = input.required<string>();
  readonly current = input<'overview' | 'tasks'>('overview');
  readonly count = input<number | null>(null);
  protected readonly active = inject(ActivePortalService);
}

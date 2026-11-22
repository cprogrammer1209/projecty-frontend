import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { CustomFieldApi } from '../../core/customfield/custom-field.api';
import { Layout, LayoutApi } from '../../core/customfield/layout.api';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { ProjectApi, ProjectDetail } from '../../core/project/project.api';
import { isEmptyValue } from '../../shared/ui/custom-value/custom-value.util';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Project settings (`/projects/:id/settings`): today only the layout the project uses. Switching never deletes
 * answers: those the new layout doesn't show are kept, hidden, and come back with a layout that has the field.
 */
@Component({
  selector: 'py-project-settings',
  imports: [RouterLink, Icon],
  templateUrl: './project-settings.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSettings implements OnInit {
  readonly id = input.required<string>();

  private readonly projectApi = inject(ProjectApi);
  private readonly layoutApi = inject(LayoutApi);
  private readonly fieldApi = inject(CustomFieldApi);
  protected readonly active = inject(ActivePortalService);

  protected readonly detail = signal<ProjectDetail | null>(null);
  private readonly activeLayouts = signal<Layout[]>([]);
  private readonly labels = signal<Record<string, string>>({});
  protected readonly selected = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly missing = signal(false);

  /** Active layouts, plus the project's own when it was deactivated since. */
  protected readonly layouts = computed(() => {
    const d = this.detail();
    const list = this.activeLayouts();
    return d && !list.some((l) => l.id === d.project.layoutId) ? [d.layout, ...list] : list;
  });
  protected readonly picked = computed(() => this.layouts().find((l) => l.id === this.selected()) ?? this.detail()?.layout ?? null);
  protected readonly changed = computed(() => this.selected() !== this.detail()?.project.layoutId);
  protected readonly shows = computed(() => (this.picked()?.sections ?? []).filter((s) => s.fields.length));

  /** What switching does: answers that stop showing (kept), and required fields of the new layout with no answer yet. */
  protected readonly impact = computed(() => {
    const d = this.detail();
    const l = this.picked();
    if (!d || !l) return { hidden: [] as string[], needs: [] as string[] };
    const answered = new Set(
      [...Object.entries(d.project.customValues), ...Object.entries(d.hiddenValues)].filter(([, v]) => !isEmptyValue(v)).map(([k]) => k),
    );
    const fields = l.sections.flatMap((s) => s.fields);
    const inNew = new Set(fields.map((f) => f.apiName));
    const labels = this.labels();
    return {
      hidden: [...answered].filter((k) => !inNew.has(k) && labels[k]).map((k) => labels[k]),
      needs: fields.filter((f) => f.mandatory && !f.readOnly && !answered.has(f.apiName)).map((f) => f.label),
    };
  });

  ngOnInit(): void {
    forkJoin([this.projectApi.get(this.id()), this.layoutApi.active(), this.fieldApi.list()]).subscribe({
      next: ([detail, layouts, fields]) => {
        this.activeLayouts.set(layouts);
        this.labels.set(Object.fromEntries(fields.map((f) => [f.apiName, f.label])));
        this.detail.set(detail);
        this.selected.set(detail.project.layoutId);
      },
      error: (err: ApiError) => {
        if (err.code === 'PROJECT_NOT_FOUND') {
          this.missing.set(true);
        } else {
          this.error.set(err.message);
        }
      },
    });
  }

  protected countFields(l: Layout): number {
    return l.sections.reduce((n, s) => n + s.fields.length, 0);
  }

  protected choose(id: string): void {
    this.selected.set(id);
    this.notice.set(null);
  }

  protected reset(): void {
    this.selected.set(this.detail()?.project.layoutId ?? null);
  }

  protected apply(): void {
    const l = this.picked();
    const d = this.detail();
    if (!l || !d) return;
    this.busy.set(true);
    this.error.set(null);
    this.projectApi.changeLayout(this.id(), l.id).subscribe({
      next: (fresh) => {
        this.detail.set(fresh);
        this.selected.set(fresh.project.layoutId);
        this.notice.set(`${l.name} applied to ${fresh.project.name}.`);
        this.busy.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.busy.set(false);
      },
    });
  }
}

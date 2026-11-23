import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LayoutStatus } from '../../../core/customfield/layout.api';
import { LayoutApi } from '../../../core/customfield/layout.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { Task, TaskApi } from '../../../core/task/task.api';

/**
 * The statuses a task can move to, by task layout. Everyone with TASKS_VIEW can read them from a task of that layout
 * (`GET /tasks/{id}`); the layout's own list needs CUSTOM_FIELDS_VIEW, so it is used only for a project without tasks.
 */
@Injectable({ providedIn: 'root' })
export class TvStatuses {
  private readonly taskApi = inject(TaskApi);
  private readonly layoutApi = inject(LayoutApi);
  private readonly active = inject(ActivePortalService);
  private readonly cache = new Map<string, Promise<LayoutStatus[]>>();
  private defaultLayout: Promise<string | null> | null = null;

  /** Forget what was read (a screen does this when it opens, so edits made in Settings show up). */
  clear(): void {
    this.cache.clear();
    this.defaultLayout = null;
  }

  /** The statuses of every layout the tasks use, and each project's own (its first task's layout, else its setting, else the default). */
  async resolve(tasks: Task[], projects: { id: string; taskLayoutId?: string | null }[]): Promise<{ layouts: Record<string, LayoutStatus[]>; byProject: Record<string, LayoutStatus[]> }> {
    const rep = new Map<string, Task>();
    for (const t of tasks) if (!rep.has(t.layoutId)) rep.set(t.layoutId, t);
    const projectLayout: Record<string, string | null> = {};
    for (const p of projects) projectLayout[p.id] = tasks.find((t) => t.projectId === p.id)?.layoutId ?? p.taskLayoutId ?? null;
    if (Object.values(projectLayout).some((v) => !v)) {
      const fallback = await this.fallbackLayout();
      for (const k of Object.keys(projectLayout)) projectLayout[k] ??= fallback;
    }
    const need = new Set<string>([...rep.keys(), ...Object.values(projectLayout).filter((v): v is string => !!v)]);
    const layouts: Record<string, LayoutStatus[]> = {};
    await Promise.all([...need].map(async (id) => (layouts[id] = await this.of(id, rep.get(id)))));
    const byProject: Record<string, LayoutStatus[]> = {};
    for (const p of projects) byProject[p.id] = layouts[projectLayout[p.id] ?? ''] ?? [];
    return { layouts, byProject };
  }

  private of(layoutId: string, task: Task | undefined): Promise<LayoutStatus[]> {
    let p = this.cache.get(layoutId);
    if (!p) {
      p = task
        ? firstValueFrom(this.taskApi.get(task.id)).then((d) => d.statuses)
        : this.active.can('CUSTOM_FIELDS_VIEW')
          ? firstValueFrom(this.layoutApi.statuses(layoutId))
          : Promise.resolve([]);
      p = p.catch(() => []);
      this.cache.set(layoutId, p);
    }
    return p;
  }

  private fallbackLayout(): Promise<string | null> {
    this.defaultLayout ??= this.active.can('CUSTOM_FIELDS_VIEW')
      ? firstValueFrom(this.layoutApi.active('TASK')).then((l) => l[0]?.id ?? null).catch(() => null)
      : Promise.resolve(null);
    return this.defaultLayout;
  }
}

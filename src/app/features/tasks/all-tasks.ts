import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ActivePortalService } from '../../core/portal/active-portal.service';
import { Project, ProjectApi } from '../../core/project/project.api';
import { PortalTask, TaskApi } from '../../core/task/task.api';
import { TaskView } from './view/task-view';
import { TvLoaded, TvSource } from './view/tv-model';
import { TvState } from './view/tv-state';
import { TvStatuses } from './view/tv-statuses';

type Tab = 'mine' | 'all';

const PAGE_SIZE = 500;
const MAX_PAGES = 8;

/**
 * The Tasks module of a portal: My Tasks (tasks I own, open by default, grouped by due date) and All Tasks (every task I
 * may see, grouped by status), both the shared task view with a Project on every row. Visibility is decided by the server
 * per project and list; this page only shows what comes back. Each tab keeps its own view, grouping and filters while
 * you switch. Rows open the usual task page with `?from=tasks|tasks-all` so its back link returns here.
 */
@Component({
  selector: 'py-all-tasks',
  imports: [RouterLink, TaskView],
  templateUrl: './all-tasks.html',
  host: { class: 'tasks-page portal-tasks' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllTasks implements OnInit {
  /** `?tab=all` from the URL (withComponentInputBinding); anything else is My Tasks. */
  readonly tab = input<string | undefined>(undefined);

  private readonly taskApi = inject(TaskApi);
  private readonly projectApi = inject(ProjectApi);
  private readonly statuses = inject(TvStatuses);
  protected readonly active = inject(ActivePortalService);

  protected readonly current = computed<Tab>(() => (this.tab() === 'all' ? 'all' : 'mine'));
  protected readonly states: Record<Tab, TvState> = {
    mine: new TvState('mine', { group: 'due', showSub: true }),
    all: new TvState('all', { group: 'status', showSub: true }),
  };
  protected sources!: Record<Tab, TvSource>;

  ngOnInit(): void {
    const make = (tab: Tab): TvSource => ({
      key: tab,
      portal: true,
      mine: tab === 'mine',
      groups: ['status', 'list', 'owner', 'priority', 'due', 'none'],
      lockedProjectId: null,
      from: tab === 'all' ? 'tasks-all' : 'tasks',
      emptyHint: tab === 'mine' ? 'Nothing assigned to you that is open. Tasks you own show up here.' : 'No tasks yet. Tasks from the projects you can see show up here.',
      load: () => this.load(tab),
    });
    this.sources = { mine: make('mine'), all: make('all') };
  }

  protected tabLink(tab: Tab): { tab: string | null } {
    return { tab: tab === 'all' ? 'all' : null };
  }

  /** Every page of the tab's tasks (the screen filters and groups them itself), the projects, and the statuses they use. */
  private async load(tab: Tab): Promise<TvLoaded> {
    const items: PortalTask[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await firstValueFrom(this.taskApi.listAll({ scope: tab, limit: PAGE_SIZE, cursor }));
      items.push(...res.items);
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    const projects = [...(await firstValueFrom(this.projectApi.list()))].sort((a, b) => a.name.localeCompare(b.name));
    const st = await this.statuses.resolve(items, projects);
    const admin = this.active.membership()?.profile === 'ADMIN';
    const canCreate = this.active.can('TASKS_CREATE');
    const known = new Set(projects.map((p: Project) => p.id));
    // a task's project that the project list does not show still needs a row's worth of data
    const extra = [...new Map(items.filter((t) => !known.has(t.projectId)).map((t) => [t.projectId, t])).values()];
    return {
      tasks: items,
      projects: [
        ...projects.map((p) => ({ id: p.id, key: p.key, name: p.name, canCreate: canCreate && (p.member || admin), statuses: st.byProject[p.id] ?? [] })),
        ...extra.map((t) => ({ id: t.projectId, key: t.projectKey, name: t.projectName, canCreate: false, statuses: [] })),
      ],
      lists: [],
      layouts: st.layouts,
    };
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { ProjectApi, ProjectDetail } from '../../core/project/project.api';
import { ListVisibility, Task, TaskApi, TaskList } from '../../core/task/task.api';
import { PyDatePipe } from '../../shared/pipes/py-date.pipe';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { takeNavigationNotice } from '../projects/navigation-notice';
import { ProjectTabs } from './project-tabs';
import { TaskView } from './view/task-view';
import { TvUiIcon } from './view/tv-glyph';
import { TvLoaded, TvSource } from './view/tv-model';
import { TvPopup } from './view/tv-popup';
import { TvState } from './view/tv-state';
import { TvStatuses } from './view/tv-statuses';

interface ListDialog {
  mode: 'new' | 'rename';
  list: TaskList | null;
}

/**
 * The Tasks tab of a project: the shared task view (grouped list or board, filters, peek, shortcuts), the Lists menu
 * (reorder, rename, archive, new list) for people who may edit, and the trash. What a person may do comes from TASKS_*
 * permissions; the server checks again.
 */
@Component({
  selector: 'py-tasks-tab',
  imports: [RouterLink, Icon, Dialog, ProjectTabs, PyDatePipe, TaskView, TvUiIcon, TvPopup],
  templateUrl: './tasks-tab.html',
  host: { class: 'tasks-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksTab implements OnInit {
  /** The project id from the route. */
  readonly id = input.required<string>();

  private readonly taskApi = inject(TaskApi);
  private readonly projectApi = inject(ProjectApi);
  private readonly statuses = inject(TvStatuses);
  protected readonly active = inject(ActivePortalService);
  private readonly view = viewChild(TaskView);

  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly missing = signal(false);
  protected readonly lists = signal<TaskList[]>([]);
  protected readonly ready = signal(false);
  protected readonly trash = signal<Task[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(takeNavigationNotice());
  protected readonly trashView = signal(false);
  protected readonly listsMenu = signal<HTMLElement | null>(null);

  protected readonly dialog = signal<ListDialog | null>(null);
  protected readonly dialogName = signal('');
  protected readonly dialogVisibility = signal<ListVisibility>('INTERNAL');
  protected readonly dialogError = signal<string | null>(null);
  protected readonly dialogBusy = signal(false);

  protected readonly canCreate = computed(() => this.active.can('TASKS_CREATE'));
  protected readonly canEdit = computed(() => this.active.can('TASKS_EDIT'));
  protected readonly canDelete = computed(() => this.active.can('TASKS_DELETE'));
  protected readonly total = computed(() => this.lists().reduce((n, l) => n + l.taskCount, 0));

  protected state!: TvState;
  protected source!: TvSource;

  ngOnInit(): void {
    this.state = new TvState(`project:${this.id()}`, { group: 'status', showSub: false });
    this.source = {
      key: `project:${this.id()}`,
      portal: false,
      mine: false,
      groups: ['status', 'list', 'owner', 'priority', 'due', 'none'],
      lockedProjectId: this.id(),
      from: '',
      emptyHint: 'No tasks yet. Add the first one with the New task button.',
      load: () => this.load(),
    };
    this.projectApi.get(this.id()).subscribe({
      next: (p) => {
        this.project.set(p);
        this.ready.set(true);
      },
      error: (err: ApiError) => (err.code === 'PROJECT_NOT_FOUND' ? this.missing.set(true) : this.error.set(err.message)),
    });
  }

  protected dateTimePattern(): string {
    return `${this.active.portal()?.dateFormat ?? 'MMM d, yyyy'}, h:mm a`;
  }

  /** What the shared view needs: the tasks, the task lists, and the statuses of the project's task layout. */
  private async load(): Promise<TvLoaded> {
    const [tasks, lists] = await Promise.all([firstValueFrom(this.taskApi.tasks(this.id())), firstValueFrom(this.taskApi.lists(this.id(), true))]);
    this.lists.set(lists);
    const detail = this.project() ?? (await firstValueFrom(this.projectApi.get(this.id())));
    const p = detail.project;
    const st = await this.statuses.resolve(tasks, [{ id: p.id, taskLayoutId: p.taskLayoutId }]);
    return {
      tasks: tasks.map((t) => ({ ...t, projectName: p.name })),
      projects: [{ id: p.id, key: p.key, name: p.name, canCreate: this.canCreate(), statuses: st.byProject[p.id] }],
      lists,
      layouts: st.layouts,
    };
  }

  /* ---------- trash ---------- */
  protected async toggleTrash(): Promise<void> {
    this.trashView.update((v) => !v);
    this.notice.set(null);
    this.error.set(null);
    this.trash.set(null);
    if (this.trashView()) await this.loadTrash();
  }

  private async loadTrash(): Promise<void> {
    try {
      this.trash.set(await firstValueFrom(this.taskApi.tasks(this.id(), { trashed: true })));
    } catch (err) {
      this.trash.set([]);
      this.error.set((err as ApiError).message);
    }
  }

  protected async restore(t: Task): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.taskApi.restore(t.id));
      this.notice.set(`${t.key} restored.`);
    } catch (err) {
      this.error.set((err as ApiError).message);
    }
    await this.loadTrash();
  }

  /* ---------- the Lists menu ---------- */
  protected toggleListsMenu(anchor: HTMLElement): void {
    this.listsMenu.set(this.listsMenu() ? null : anchor);
  }

  /** Runs a list change, reports it in the view, reloads. A failure shows as a toast-style message in the view. */
  private async act(call: () => Promise<unknown>, notice: string | null = null): Promise<void> {
    try {
      await call();
      if (notice) this.view()?.setNotice(notice);
    } catch (err) {
      this.view()?.setNotice(null);
      this.error.set((err as ApiError).message);
    }
    await this.view()?.refresh();
  }

  protected archive(list: TaskList, archive: boolean): void {
    void this.act(() => firstValueFrom(this.taskApi.archiveList(list.id, archive)), archive ? `${list.name} archived. Its tasks are kept.` : `${list.name} is active again.`);
  }

  protected moveList(list: TaskList, step: number): void {
    const ids = this.lists().map((l) => l.id);
    const from = ids.indexOf(list.id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    void this.act(() => firstValueFrom(this.taskApi.orderLists(this.id(), ids)));
  }

  protected isFirst(list: TaskList): boolean {
    return this.lists()[0]?.id === list.id;
  }

  protected isLast(list: TaskList): boolean {
    return this.lists()[this.lists().length - 1]?.id === list.id;
  }

  protected openNewList(): void {
    this.listsMenu.set(null);
    this.dialogName.set('');
    this.dialogVisibility.set('INTERNAL');
    this.dialogError.set(null);
    this.dialog.set({ mode: 'new', list: null });
  }

  protected openRename(list: TaskList): void {
    this.listsMenu.set(null);
    this.dialogName.set(list.name);
    this.dialogVisibility.set(list.visibility);
    this.dialogError.set(null);
    this.dialog.set({ mode: 'rename', list });
  }

  protected closeDialog(): void {
    this.dialog.set(null);
  }

  protected async submitDialog(): Promise<void> {
    const d = this.dialog();
    if (!d || this.dialogBusy()) return;
    this.dialogBusy.set(true);
    this.dialogError.set(null);
    const name = this.dialogName().trim();
    try {
      if (d.mode === 'new') {
        await firstValueFrom(this.taskApi.createList(this.id(), { name, visibility: this.dialogVisibility() }));
        this.view()?.setNotice(`List ${name} created.`);
      } else if (d.list) {
        await firstValueFrom(this.taskApi.updateList(d.list.id, { name, visibility: this.dialogVisibility() }));
        this.view()?.setNotice(`${name} saved.`);
      }
      this.dialog.set(null);
      await this.view()?.refresh();
    } catch (err) {
      const e = err as ApiError;
      const detail = e.details?.['name'];
      this.dialogError.set(typeof detail === 'string' ? detail : e.message);
    }
    this.dialogBusy.set(false);
  }
}

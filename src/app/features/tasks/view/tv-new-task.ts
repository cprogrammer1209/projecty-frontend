import { OnInit, ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

import { LayoutStatus } from '../../../core/customfield/layout.api';
import { TaskPriority } from '../../../core/task/task.api';
import { Autofocus } from '../../projects/autofocus';
import { Icon } from '../../../shared/ui/icon/icon';
import { PyDayPipe } from '../../../shared/pipes/py-day.pipe';
import { addDays } from '../task-ui';
import { statusKey } from './tv-logic';
import { TvGlyph, TvUiIcon } from './tv-glyph';
import { PRIO_LABEL, PRIO_ORDER, TvIcon, TvItem } from './tv-model';
import { TvDefaults, TvStore } from './tv-store';

/** The New task modal (the C key or the New task button): title, description, and the same pickers a row has; "Create more" keeps it open. */
@Component({
  selector: 'py-tv-new-task',
  imports: [TvGlyph, TvUiIcon, Icon, Autofocus, PyDayPipe],
  templateUrl: './tv-new-task.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvNewTask implements OnInit {
  readonly init = input.required<TvDefaults>();
  readonly closed = output<void>();
  protected readonly store = inject(TvStore);

  protected readonly projectId = signal('');
  protected readonly title = signal('');
  protected readonly desc = signal('');
  protected readonly statusKeyV = signal<string | null>(null);
  protected readonly priority = signal<TaskPriority>('NONE');
  protected readonly ownerIds = signal<string[]>([]);
  protected readonly dueDate = signal<string | null>(null);
  protected readonly listId = signal<string | null>(null);
  protected readonly more = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly titleFocus = signal(0);

  protected readonly projects = computed(() => this.store.data()?.projects.filter((p) => p.canCreate) ?? []);
  protected readonly project = computed(() => this.store.data()?.byProject[this.projectId()]);
  protected readonly statuses = computed<LayoutStatus[]>(() => this.project()?.statuses ?? []);
  protected readonly status = computed(() => this.statuses().find((s) => statusKey(s.name) === this.statusKeyV()) ?? this.statuses().find((s) => s.defaultStatus) ?? this.statuses()[0]);
  protected readonly lists = computed(() => (this.store.source.portal ? [] : (this.store.data()?.lists.filter((l) => !l.archived) ?? [])));
  protected readonly list = computed(() => this.lists().find((l) => l.id === this.listId()) ?? this.lists()[0]);
  protected readonly ownerNames = computed(() => this.ownerIds().map((id) => this.store.people.nameOf(id)));
  protected readonly prioLabel = PRIO_LABEL;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || this.store.menu()) return;
      e.stopPropagation();
      this.closed.emit();
    };
    document.addEventListener('keydown', key, true);
    destroyRef.onDestroy(() => document.removeEventListener('keydown', key, true));
  }

  ngOnInit(): void {
    const d = this.init();
    this.projectId.set(d.projectId ?? this.store.source.lockedProjectId ?? this.projects()[0]?.id ?? '');
    this.statusKeyV.set(d.statusKey ?? null);
    this.priority.set(d.priority ?? 'NONE');
    this.ownerIds.set(d.ownerIds ?? []);
    this.dueDate.set(d.dueDate ?? null);
    this.listId.set(d.listId ?? null);
  }

  protected setProject(id: string): void {
    this.projectId.set(id);
    this.statusKeyV.set(null);
    this.listId.set(null);
  }

  protected pick(kind: 'status' | 'priority' | 'owner' | 'due' | 'list', event: Event): void {
    const anchor = event.currentTarget as HTMLElement;
    const open = (items: TvItem[], onPick: (id: string, items: TvItem[]) => void, extra: { multi?: boolean; search?: string } = {}): void => this.store.menu.set({ anchor, items, onPick, ...extra });
    if (kind === 'status') {
      open(this.statuses().map((s) => ({ id: statusKey(s.name), label: s.name, on: this.status() === s, icon: this.store.statusIcon(s) })), (id) => this.statusKeyV.set(id));
    } else if (kind === 'priority') {
      open(PRIO_ORDER.map((p) => ({ id: p, label: PRIO_LABEL[p], on: this.priority() === p, icon: { k: 'prio', p } as TvIcon })), (id) => this.priority.set(id as TaskPriority));
    } else if (kind === 'owner') {
      open(
        this.store.people.activeMembers().map((p) => ({ id: p.userId, label: p.fullName, on: this.ownerIds().includes(p.userId), icon: { k: 'person', name: p.fullName } as TvIcon })),
        (_id, items) => this.ownerIds.set(items.filter((i) => i.on).map((i) => i.id)),
        { multi: true, search: 'Assign to…' },
      );
    } else if (kind === 'due') {
      const today = this.store.data()?.today ?? '';
      const opts: [string, string | null][] = [['Today', today], ['Tomorrow', addDays(today, 1)], ['In a week', addDays(today, 7)], ['No due date', null]];
      open(opts.map(([label], i) => ({ id: String(i), label, icon: { k: 'ui', n: 'cal' } as TvIcon })), (i) => this.dueDate.set(opts[+i][1]));
    } else {
      open(this.lists().map((l) => ({ id: l.id, label: l.name, on: this.list()?.id === l.id, icon: { k: 'ui', n: 'stack' } as TvIcon })), (id) => this.listId.set(id));
    }
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    if (!this.title().trim()) return this.error.set('Give the task a title.');
    this.busy.set(true);
    this.error.set(null);
    try {
      const made = await this.store.create(
        { projectId: this.projectId(), statusKey: this.statusKeyV() ?? undefined, priority: this.priority(), ownerIds: this.ownerIds(), dueDate: this.dueDate() ?? undefined, listId: this.listId() ?? undefined },
        this.title(),
        this.desc().trim() ? { description: this.desc() } : {},
      );
      this.store.setNotice(`${made.key} created in ${made.project.name}.`);
      if (this.more()) {
        this.title.set('');
        this.desc.set('');
        this.titleFocus.update((n) => n + 1);
      } else this.closed.emit();
      await this.store.refresh();
    } catch (err) {
      this.error.set((err as Error).message);
    }
    this.busy.set(false);
  }
}

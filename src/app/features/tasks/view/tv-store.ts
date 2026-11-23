import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LayoutStatus } from '../../../core/customfield/layout.api';
import { PortalPeople } from '../../../core/member/portal-people.service';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { TaskApi, TaskInput, TaskPatch, TaskPriority } from '../../../core/task/task.api';
import { addDays, propertyError, todayIn, weekEnd } from '../task-ui';
import { GroupOptions, buildGroups, isFiltered, statusGroups, statusKey, statusesOf, visibleTasks } from './tv-logic';
import {
  FILTER_KEYS, PRIO_LABEL, PRIO_ORDER, TV_GROUPS, TvData, TvFilterKey, TvGroup, TvGroupId, TvIcon, TvItem, TvMenuSpec, TvProject, TvSource, TvTask,
} from './tv-model';
import { TvState } from './tv-state';

const TOAST_MS = 3200;

export interface QuickAdd {
  gid: string;
  text: string;
  error: string | null;
  projectId: string | null;
  busy: boolean;
}

/** What a New task starts with, from the group it was opened from. */
export interface TvDefaults {
  projectId?: string;
  statusKey?: string;
  priority?: TaskPriority;
  ownerIds?: string[];
  dueDate?: string;
  listId?: string;
}

export interface TvConfirm {
  title: string;
  lead: string;
  label: string;
  done: (ok: boolean) => void;
}

/**
 * Everything the task view knows and does, once per view (provided by `py-task-view`): the loaded data, the filters
 * and grouping, what is focused, selected or peeked, and every change a person can make from the list or the board.
 * Every status change goes through `changeStatus` (the one path: it asks before closing a task with open subtasks).
 */
@Injectable()
export class TvStore {
  private readonly api = inject(TaskApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly active = inject(ActivePortalService);
  readonly people = inject(PortalPeople);

  source!: TvSource;
  state!: TvState;

  readonly data = signal<TvData | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly toastText = signal<string | null>(null);
  readonly focus = signal<string | null>(null);
  readonly checked = signal<ReadonlySet<string>>(new Set());
  readonly peek = signal<string | null>(null);
  readonly quickAdd = signal<QuickAdd | null>(null);
  readonly menu = signal<TvMenuSpec | null>(null);
  readonly toolbarMenu = signal<{ kind: 'display' | 'filter'; anchor: HTMLElement } | null>(null);
  readonly newTask = signal<TvDefaults | null>(null);
  readonly confirm = signal<TvConfirm | null>(null);
  readonly palette = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private loadId = 0;

  readonly filtered = computed(() => isFiltered(this.state.filter()));
  readonly visible = computed(() => {
    const d = this.data();
    return d ? visibleTasks(d, this.state.filter(), { showArchived: this.state.showArchived(), showSub: this.state.showSub(), showClosed: this.state.showClosed(), mine: this.source.mine }) : [];
  });
  /** The grouping the screen is drawn with: the board has no "none" or "due" columns (they fall back to status). */
  readonly groupKey = computed<TvGroupId>(() => {
    const g = this.state.group();
    return this.state.view() === 'board' && (g === 'none' || g === 'due') ? 'status' : g;
  });
  readonly groups = computed<TvGroup[]>(() => {
    const d = this.data();
    if (!d) return [];
    const o: GroupOptions = { portal: this.source.portal, showArchived: this.state.showArchived(), filtered: this.filtered(), board: this.state.view() === 'board', people: this.people.activeMembers() };
    return buildGroups(d, this.visible(), this.groupKey(), o);
  });
  /** Task ids in the order they are on screen (folded groups leave theirs out), for J/K and peek stepping. */
  readonly order = computed<string[]>(() => {
    const board = this.state.view() === 'board';
    const fold = this.state.fold();
    return this.groups().flatMap((g) => (!board && fold[`${this.groupKey()}:${g.id}`] ? [] : g.items.map((t) => t.id)));
  });
  readonly canCreateAny = computed(() => !!this.data()?.projects.some((p) => p.canCreate));
  readonly me = computed(() => this.auth.me());

  init(source: TvSource, state: TvState): void {
    this.source = source;
    this.state = state;
    void this.refresh();
  }

  /* ---------- data ---------- */
  async refresh(): Promise<void> {
    const id = ++this.loadId;
    try {
      const raw = await this.source.load();
      if (id !== this.loadId) return;
      const today = todayIn(this.active.timeZone());
      const byProject = Object.fromEntries(raw.projects.map((p) => [p.id, p]));
      this.data.set({ ...raw, byProject, today, weekEnd: weekEnd(today, this.active.portal()?.weekStart ?? 'MONDAY') });
      this.error.set(null);
      const ids = new Set(raw.tasks.map((t) => t.id));
      const kept = [...this.checked()].filter((x) => ids.has(x));
      if (kept.length !== this.checked().size) this.checked.set(new Set(kept));
    } catch (err) {
      if (id === this.loadId) this.error.set((err as Error).message);
    }
  }

  byId(id: string): TvTask | undefined {
    return this.data()?.tasks.find((t) => t.id === id);
  }

  setNotice(message: string | null): void {
    this.notice.set(message);
  }

  toast(message: string): void {
    this.toastText.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastText.set(null), TOAST_MS);
  }

  ownerNames(t: TvTask): string[] {
    return t.ownerIds.map((id) => this.people.nameOf(id));
  }

  statusIcon(s: LayoutStatus | undefined, t?: TvTask): TvIcon {
    return { k: 'status', s: s ?? { color: t?.statusColor ?? null, statusType: t?.statusType ?? 'OPEN', defaultStatus: false } };
  }

  /** The status of a task as a glyph: its layout status when known, else what the task itself carries. */
  taskStatusIcon(t: TvTask): TvIcon {
    const d = this.data();
    const s = d ? statusesOf(d, t).find((x) => x.id === t.statusId) : undefined;
    return s ? { k: 'status', s } : { k: 'status', s: { color: t.statusColor, statusType: t.statusType, defaultStatus: false } };
  }

  groupIcon(g: TvGroup, key: TvGroupId): TvIcon | null {
    if (key === 'status') return this.statusIcon(g.status);
    if (key === 'priority') return { k: 'prio', p: g.prio ?? 'NONE' };
    if (key === 'owner') return { k: 'person', name: g.ownerId && g.ownerId !== 'none' ? this.people.nameOf(g.ownerId) : null };
    if (key === 'list') return { k: 'ui', n: 'stack' };
    return null;
  }

  hrefOf(t: TvTask): { link: string[]; query: Record<string, string> } {
    return { link: ['/p', this.active.portal()?.slug ?? '', 'projects', t.projectId, 'tasks', t.id], query: this.source.from ? { from: this.source.from } : {} };
  }

  openPage(t: TvTask): void {
    const h = this.hrefOf(t);
    void this.router.navigate(h.link, { queryParams: h.query });
  }

  /* ---------- selection and focus ---------- */
  toggleCheck(id: string): void {
    const next = new Set(this.checked());
    if (!next.delete(id)) next.add(id);
    this.checked.set(next);
  }

  clearChecked(): void {
    this.checked.set(new Set());
  }

  toggleFold(key: string): void {
    this.state.fold.update((f) => ({ ...f, [key]: !f[key] }));
    this.state.save();
  }

  /* ---------- filters ---------- */
  setQuery(q: string): void {
    this.state.filter.update((f) => ({ ...f, q }));
  }

  toggleFilter(key: TvFilterKey, value: string): void {
    this.state.filter.update((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));
  }

  clearFilter(key: TvFilterKey | 'q'): void {
    this.state.filter.update((f) => ({ ...f, [key]: key === 'q' ? '' : [] }));
  }

  clearAllFilters(): void {
    this.state.filter.update((f) => ({ ...f, q: '', ...Object.fromEntries(FILTER_KEYS.map((k) => [k, []])) }));
  }

  /** The filter categories on offer, with the label of one value. */
  filterDefs(): { key: TvFilterKey; label: string; name: (v: string) => string }[] {
    const d = this.data();
    return [
      { key: 'status', label: 'Status', name: (v) => (d ? statusGroups(d).find((g) => g.id === v)?.label : undefined) ?? v },
      { key: 'priority', label: 'Priority', name: (v) => PRIO_LABEL[v as TaskPriority] ?? v },
      { key: 'owner', label: 'Owner', name: (v) => (v === 'none' ? 'Unassigned' : this.people.nameOf(v)) },
      ...(this.source.portal ? [{ key: 'project' as TvFilterKey, label: 'Project', name: (v: string) => d?.byProject[v]?.name ?? v }] : []),
      { key: 'tag', label: 'Tag', name: (v) => v },
    ];
  }

  filterItems(key: TvFilterKey): TvItem[] {
    const d = this.data();
    if (!d) return [];
    const f = this.state.filter()[key];
    const items: TvItem[] =
      key === 'status' ? statusGroups(d).map((g) => ({ id: g.id, label: g.label, icon: this.statusIcon(g.status) }))
      : key === 'priority' ? PRIO_ORDER.map((p) => ({ id: p, label: PRIO_LABEL[p], icon: { k: 'prio', p } as TvIcon }))
      : key === 'owner' ? [...this.people.activeMembers().map((p) => ({ id: p.userId, label: p.fullName, icon: { k: 'person', name: p.fullName } as TvIcon })), { id: 'none', label: 'Unassigned', icon: { k: 'person', name: null } as TvIcon }]
      : key === 'project' ? d.projects.map((p) => ({ id: p.id, label: p.name }))
      : [...new Set(d.tasks.flatMap((t) => t.tags))].sort().map((x) => ({ id: x, label: x, tag: true }));
    return items.map((i) => ({ ...i, on: f.includes(i.id) }));
  }

  /* ---------- changes ---------- */
  canEdit(t: TvTask): boolean {
    return t.canEdit;
  }

  private need(ts: TvTask[]): boolean {
    if (ts.every((t) => this.canEdit(t))) return true;
    this.toast('You can read this task, but only project members can change it.');
    return false;
  }

  private ask(title: string, lead: string, label: string): Promise<boolean> {
    return new Promise((done) => this.confirm.set({ title, lead, label, done }));
  }

  private statusFor(t: TvTask, key: string): LayoutStatus | undefined {
    const d = this.data();
    return d ? statusesOf(d, t).find((s) => statusKey(s.name) === key) : undefined;
  }

  /** Runs `fn` for each task one after the other; failures show as one toast; always reloads. */
  private async applyMany(ts: TvTask[], fn: (t: TvTask) => Promise<unknown>): Promise<void> {
    const failed: Error[] = [];
    for (const t of ts) {
      try {
        await fn(t);
      } catch (err) {
        failed.push(propertyError(err, 'statusId'));
      }
    }
    if (failed.length) this.toast(failed[0].message + (failed.length > 1 ? ` (${failed.length} failed)` : ''));
    await this.refresh();
  }

  /** The one way a task changes status (list picker, bulk bar, keyboard, board drag): asks first when closing a task with open subtasks. */
  async changeStatus(ts: TvTask[], key: string): Promise<void> {
    const todo = ts.filter((t) => statusKey(t.statusName) !== key);
    if (!todo.length || !this.need(todo)) return;
    const missing = todo.find((t) => !this.statusFor(t, key));
    if (missing) return this.toast(`${missing.projectName} has no "${key}" status.`);
    const open = todo.filter((t) => this.statusFor(t, key)?.statusType === 'CLOSED' && t.statusType !== 'CLOSED' && t.subtaskCount > t.completedSubtaskCount);
    if (open.length) {
      const one = open.length === 1;
      const ok = await this.ask(
        one ? `Close ${open[0].key}?` : `Close ${open.length} tasks?`,
        one ? `${open[0].key} still has ${open[0].subtaskCount - open[0].completedSubtaskCount} open subtask(s). They stay open if you close it.` : 'Some of these tasks still have open subtasks. The subtasks stay open if you close them.',
        'Close anyway',
      );
      if (!ok) return;
    }
    await this.applyMany(todo, (t) => firstValueFrom(this.api.changeStatus(t.id, (this.statusFor(t, key) as LayoutStatus).id)));
  }

  async patch(ts: TvTask[], patch: TaskPatch): Promise<void> {
    if (!this.need(ts)) return;
    const key = Object.keys(patch)[0] ?? 'title';
    const failed: Error[] = [];
    for (const t of ts) {
      try {
        await firstValueFrom(this.api.update(t.id, patch));
      } catch (err) {
        failed.push(propertyError(err, key));
      }
    }
    if (failed.length) this.toast(failed[0].message + (failed.length > 1 ? ` (${failed.length} failed)` : ''));
    await this.refresh();
  }

  /** A board card dropped on a column: the column's grouping decides what changes. */
  async moveTo(id: string, key: TvGroupId, gid: string): Promise<void> {
    const t = this.byId(id);
    if (!t || !this.need([t])) return;
    if (key === 'status') return this.changeStatus([t], gid);
    if (key === 'priority') return t.priority === gid ? undefined : this.patch([t], { priority: gid as TaskPriority });
    if (key === 'owner') return this.patch([t], { ownerIds: gid === 'none' ? [] : [gid] });
    if (key === 'list') {
      if (t.parentId) return this.toast("A subtask stays in its parent's list.");
      if (t.listId !== gid) return this.patch([t], { listId: gid });
    }
  }

  /* ---------- pickers ---------- */
  private due(): [string, string | null][] {
    const today = this.data()?.today ?? todayIn(this.active.timeZone());
    return [['Today', today], ['Tomorrow', addDays(today, 1)], ['In a week', addDays(today, 7)], ['In two weeks', addDays(today, 14)], ['No due date', null]];
  }

  /** Opens the picker for a property of one task or of the selection. */
  pick(kind: 'status' | 'priority' | 'owner' | 'due', ids: string[], anchor: HTMLElement): void {
    const d = this.data();
    const ts = ids.map((i) => this.byId(i)).filter((t): t is TvTask => !!t);
    if (!d || !ts.length || !this.need(ts)) return;
    const one = ts.length === 1 ? ts[0] : null;
    const spec = (s: Omit<TvMenuSpec, 'anchor'>): void => this.menu.set({ anchor, ...s });
    if (kind === 'status') {
      const seen = new Map<string, LayoutStatus>();
      ts.forEach((t) => statusesOf(d, t).forEach((s) => !seen.has(statusKey(s.name)) && seen.set(statusKey(s.name), s)));
      const cur = one ? statusKey(one.statusName) : null;
      spec({ search: 'Change status…', num: true, items: [...seen.entries()].map(([k, s]) => ({ id: k, label: s.name, on: k === cur, icon: this.statusIcon(s) })), onPick: (k) => void this.changeStatus(ts, k) });
    } else if (kind === 'priority') {
      spec({ search: 'Set priority…', num: true, items: PRIO_ORDER.map((p) => ({ id: p, label: PRIO_LABEL[p], on: one?.priority === p, icon: { k: 'prio', p } as TvIcon })), onPick: (p) => void this.patch(ts, { priority: p as TaskPriority }) });
    } else if (kind === 'owner') {
      const me = this.me()?.id;
      const person = (id: string, name: string): TvItem => ({ id, label: name, icon: { k: 'person', name }, hint: id === me ? 'You' : undefined });
      if (one) {
        const members = this.people.activeMembers().map((p) => person(p.userId, p.fullName));
        // someone who left the portal still shows (by id), so removing them stays possible
        one.ownerIds.filter((id) => !members.some((m) => m.id === id)).forEach((id) => members.push(person(id, this.people.nameOf(id))));
        spec({ search: 'Assign to…', multi: true, items: members.map((m) => ({ ...m, on: one.ownerIds.includes(m.id) })), onPick: (_i, items) => void this.patch([one], { ownerIds: items.filter((x) => x.on).map((x) => x.id) }) });
      } else {
        spec({ search: 'Assign all to…', items: [{ id: 'none', label: 'No owner', icon: { k: 'person', name: null } }, ...this.people.activeMembers().map((p) => person(p.userId, p.fullName))], onPick: (v) => void this.patch(ts, { ownerIds: v === 'none' ? [] : [v] }) });
      }
    } else {
      const opts = this.due();
      spec({
        title: 'Due date',
        items: opts.map(([label, v], i) => ({ id: String(i), label, on: !!v && one?.dueDate === v, icon: { k: 'ui', n: 'cal' } as TvIcon, hint: v ?? undefined })),
        onPick: (i) => void this.patch(ts, { dueDate: opts[+i][1] }),
        onDate: (iso) => void this.patch(ts, { dueDate: iso }),
      });
    }
  }

  /* ---------- create ---------- */
  /** What a new task takes from the group it is added in (and from My Tasks: me as owner). */
  defaultsFor(gid: string | null, key: TvGroupId): TvDefaults {
    const d: TvDefaults = {};
    if (this.source.mine && this.me()) d.ownerIds = [this.me()?.id as string];
    const data = this.data();
    if (!gid || !data) return d;
    if (key === 'status') d.statusKey = gid;
    else if (key === 'priority') d.priority = gid as TaskPriority;
    else if (key === 'owner') d.ownerIds = gid === 'none' ? [] : [gid];
    else if (key === 'list') {
      if (this.source.portal) {
        const [pid, lid] = gid.split(':');
        d.projectId = pid;
        d.listId = lid;
      } else d.listId = gid;
    } else if (key === 'due') {
      if (gid === 'today') d.dueDate = data.today;
      else if (gid === 'week') d.dueDate = addDays(data.today, 3);
      else if (gid === 'later') d.dueDate = addDays(data.today, 14);
    }
    return d;
  }

  async create(d: TvDefaults, title: string, extra: Partial<TaskInput> = {}): Promise<{ key: string; project: TvProject }> {
    const data = this.data() as TvData;
    const projectId = d.projectId ?? this.source.lockedProjectId ?? data.projects.find((p) => p.canCreate)?.id;
    const project = projectId ? data.byProject[projectId] : undefined;
    if (!project) throw new Error('Pick a project first.');
    const status = d.statusKey ? project.statuses.find((s) => statusKey(s.name) === d.statusKey) : undefined;
    const body: TaskInput = {
      title,
      ...(d.ownerIds ? { ownerIds: d.ownerIds } : {}),
      ...(d.priority && d.priority !== 'NONE' ? { priority: d.priority } : {}),
      ...(d.dueDate ? { dueDate: d.dueDate } : {}),
      ...(d.listId ? { listId: d.listId } : {}),
      ...(status ? { statusId: status.id } : {}),
      ...extra,
    };
    try {
      const made = await firstValueFrom(this.api.create(project.id, body));
      return { key: made.key, project };
    } catch (err) {
      throw propertyError(err, 'title');
    }
  }

  openQuickAdd(gid: string): void {
    const cur = this.quickAdd();
    this.quickAdd.set(cur?.gid === gid ? null : { gid, text: '', error: null, projectId: this.data()?.projects.find((p) => p.canCreate)?.id ?? null, busy: false });
  }

  async submitQuickAdd(title: string): Promise<void> {
    const qa = this.quickAdd();
    if (!qa || !title.trim() || qa.busy) return;
    const d = this.defaultsFor(qa.gid, this.groupKey());
    if (this.source.portal && qa.projectId) {
      d.projectId = qa.projectId;
      delete d.listId;
    }
    this.quickAdd.set({ ...qa, busy: true, error: null, text: '' });
    try {
      await this.create(d, title);
    } catch (err) {
      this.quickAdd.update((q) => (q ? { ...q, error: (err as Error).message, text: title } : q));
    }
    this.quickAdd.update((q) => (q ? { ...q, busy: false } : q));
    await this.refresh();
  }

  openNew(gid: string | null = null): void {
    if (!this.canCreateAny()) return;
    this.menu.set(null);
    this.toolbarMenu.set(null);
    this.newTask.set(this.defaultsFor(gid, this.groupKey()));
  }

  /* ---------- peek ---------- */
  openPeek(id: string): void {
    if (!this.byId(id)) return;
    this.peek.set(id);
    this.focus.set(id);
  }

  closePeek(refresh = true): void {
    if (!this.peek()) return;
    this.peek.set(null);
    if (refresh) void this.refresh();
  }

  stepPeek(d: number): void {
    const i = this.order().indexOf(this.peek() ?? '');
    const next = this.order()[i + d];
    if (next) this.openPeek(next);
  }

  /** Group choices of the display menu. */
  groupChoices(): { id: TvGroupId; label: string }[] {
    return TV_GROUPS.filter((g) => this.source.groups.includes(g.id));
  }
}

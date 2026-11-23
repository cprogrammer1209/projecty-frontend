import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { CustomFieldApi } from '../../core/customfield/custom-field.api';
import { LayoutField, LayoutSection } from '../../core/customfield/layout.api';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { ProjectApi } from '../../core/project/project.api';
import { Task, TaskActivity, TaskApi, TaskComment, TaskDetail as TaskDetailData, TaskPatch } from '../../core/task/task.api';
import { PyDatePipe } from '../../shared/pipes/py-date.pipe';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';
import { TvGlyph, TvOwners, TvUiIcon } from './view/tv-glyph';
import { TvIcon } from './view/tv-model';
import { TvPalette } from './view/tv-palette';
import { Autofocus } from '../projects/autofocus';
import { PropertyList, SaveValue } from '../projects/property-list';
import { PRIORITIES, isOverdue, option, priorityLabel, propertyError } from './task-ui';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  startDate: 'start date',
  dueDate: 'due date',
  workHours: 'work hours',
  completion: 'completion',
  ownerIds: 'owners',
  tags: 'tags',
  followerIds: 'followers',
  listId: 'list',
  parentId: 'parent task',
  layoutId: 'layout',
};

const COMMENT_ACTIONS: Record<string, string> = {
  TASK_COMMENT_ADDED: 'commented',
  TASK_COMMENT_EDITED: 'edited a comment',
  TASK_COMMENT_DELETED: 'deleted a comment',
};

interface SubtaskRow {
  task: Task;
  level: number;
}

const field = (apiName: string, label: string, fieldType: LayoutField['fieldType'], extra: Partial<LayoutField> = {}): LayoutField => ({
  fieldId: apiName,
  apiName,
  label,
  description: null,
  fieldType,
  mandatory: false,
  fieldMandatory: false,
  readOnly: false,
  wide: false,
  unique: false,
  sensitive: false,
  defaultValue: null,
  config: {},
  options: [],
  ...extra,
});

/**
 * One task: every property edits in place and saves on its own (PATCH of that property only), plus subtasks with quick
 * add, comments, activity, followers, tags and the custom fields of the task's layout.
 */
@Component({
  selector: 'py-task-detail',
  imports: [RouterLink, NgTemplateOutlet, Icon, Dialog, PropertyList, PyDayPipe, PyDatePipe, Autofocus, TvGlyph, TvOwners, TvUiIcon, TvPalette],
  templateUrl: './task-detail.html',
  host: { class: 'tasks-page detail', '[class.peek]': 'compact()', '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetail implements OnInit {
  /** The project id and task id from the route. */
  readonly id = input.required<string>();
  readonly tid = input.required<string>();
  /** Where the person came from (`?from=tasks|tasks-all`, the portal Tasks module); the back link returns there. */
  readonly from = input<string | undefined>(undefined);
  /** The side-panel form (peek): no breadcrumb, the properties under the title; a subtask opens in the panel, a deleted task closes it. */
  readonly compact = input(false);
  readonly trashed = output<string>();
  readonly subOpen = output<string>();

  private readonly taskApi = inject(TaskApi);
  private readonly projectApi = inject(ProjectApi);
  private readonly fieldApi = inject(CustomFieldApi);
  private readonly router = inject(Router);
  private readonly dayPipe = new PyDayPipe();
  protected readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  /** The page behind the back link: the portal Tasks tab it was opened from, else the project's Tasks tab. */
  protected readonly back = computed(() => {
    const slug = this.active.portal()?.slug;
    const from = this.from();
    if (from === 'tasks' || from === 'tasks-all') {
      return { link: ['/p', slug, 'tasks'], query: from === 'tasks-all' ? { tab: 'all' } : {}, label: from === 'tasks-all' ? 'All tasks' : 'My tasks' };
    }
    return { link: ['/p', slug, 'projects', this.id(), 'tasks'], query: {}, label: `${this.projectName()} · Tasks` };
  });
  /** Query parameters that keep `from` when moving between a task and its parent or subtasks. */
  protected readonly keepFrom = computed(() => (this.from() === 'tasks' || this.from() === 'tasks-all' ? { from: this.from() } : {}));

  protected readonly data = signal<TaskDetailData | null>(null);
  protected readonly projectName = signal('');
  protected readonly parent = signal<Task | null>(null);
  protected readonly missing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly projectTags = signal<string[]>([]);
  protected readonly fieldLabels = signal<Record<string, string>>({});
  protected readonly lists = signal<{ id: string; name: string }[]>([]);

  protected readonly editTitle = signal(false);
  protected readonly titleDraft = signal('');
  protected readonly titleError = signal<string | null>(null);
  protected readonly subError = signal<string | null>(null);
  protected readonly subBusy = signal(false);
  protected readonly palette = signal(false);
  protected readonly closeAsk = signal<{ key: string; open: number; done: (ok: boolean) => void } | null>(null);
  protected readonly commentText = signal('');
  protected readonly commentError = signal<string | null>(null);
  protected readonly commentBusy = signal(false);
  protected readonly editingComment = signal<string | null>(null);
  protected readonly editText = signal('');
  protected readonly editError = signal<string | null>(null);
  protected readonly deleteComment = signal<TaskComment | null>(null);
  protected readonly confirmTrash = signal(false);
  protected readonly busy = signal(false);
  protected readonly tagError = signal<string | null>(null);
  private savingTitle = false;

  protected readonly initials = initials;
  protected readonly priorityLabel = priorityLabel;

  protected readonly task = computed(() => this.data()?.task ?? null);
  protected readonly canEdit = computed(() => !!this.task()?.canEdit);
  protected readonly me = computed(() => this.auth.me());
  protected readonly following = computed(() => !!this.data()?.followers.includes(this.me()?.id ?? ''));
  protected readonly sections = computed<LayoutSection[]>(() => (this.data()?.layout.sections ?? []).filter((s) => s.fields.length));
  protected readonly hiddenKeys = computed(() => Object.keys(this.data()?.hiddenValues ?? {}));
  protected readonly freePeople = computed(() => {
    const held = new Set(this.data()?.followers ?? []);
    return this.people.activeMembers().filter((m) => !held.has(m.userId));
  });
  protected readonly freeTags = computed(() => {
    const have = new Set((this.task()?.tags ?? []).map((t) => t.toLowerCase()));
    return this.projectTags().filter((t) => !have.has(t.toLowerCase()));
  });

  protected readonly descriptionFields = [field('description', 'Description', 'LONG_TEXT', { wide: true, config: { maxLength: 10000 } })];
  protected readonly descriptionValues = computed<Record<string, unknown>>(() => ({ description: this.task()?.description ?? null }));

  /** The standard properties as pickers (a property's apiName is the key an update sends). */
  protected readonly coreFields = computed<LayoutField[]>(() => {
    const d = this.data();
    if (!d) return [];
    const t = d.task;
    const peopleOptions = this.people.activeMembers().map((m, i) => option(m.userId, m.fullName, i));
    // A person who left the portal still shows, by id, instead of vanishing from the picker.
    for (const id of t.ownerIds) if (!peopleOptions.some((o) => o.id === id)) peopleOptions.push(option(id, this.people.nameOf(id), 999));
    return [
      field('statusId', 'Status', 'PICKLIST', {
        mandatory: true,
        options: d.statuses.map((s, i) => option(s.id, `${s.name} (${s.statusType === 'CLOSED' ? 'Closed' : 'Open'})`, i)),
      }),
      field('priority', 'Priority', 'PICKLIST', { mandatory: true, options: PRIORITIES.map((p, i) => option(p.id, p.label, i)) }),
      field('ownerIds', 'Owners', 'MULTI_PICKLIST', { options: peopleOptions }),
      field('startDate', 'Start date', 'DATE'),
      field('dueDate', 'Due date', 'DATE'),
      field('workHours', 'Work hours', 'DECIMAL', { config: { min: 0, decimals: 2 } }),
      field('completion', 'Completion (%)', 'NUMBER', { mandatory: true, readOnly: t.statusType === 'CLOSED', config: { min: 0, max: 100 } }),
      ...(t.parentId ? [] : [field('listId', 'List', 'PICKLIST', { mandatory: true, options: this.lists().map((l, i) => option(l.id, l.name, i)) })]),
    ];
  });

  protected readonly coreValues = computed<Record<string, unknown>>(() => {
    const t = this.task();
    return t
      ? { statusId: t.statusId, priority: t.priority, ownerIds: t.ownerIds, startDate: t.startDate, dueDate: t.dueDate, workHours: t.workHours, completion: t.completion, listId: t.listId }
      : {};
  });

  /** One timeline, oldest first: the changes and the comments together. */
  protected readonly timeline = computed<({ at: number } & ({ a: TaskActivity; c?: undefined } | { c: TaskComment; a?: undefined }))[]>(() => {
    const d = this.data();
    if (!d) return [];
    const changes = d.activity.filter((a) => !COMMENT_ACTIONS[a.action]).map((a) => ({ at: Date.parse(a.createdAt), a }));
    const comments = d.comments.map((c) => ({ at: Date.parse(c.createdAt), c }));
    return [...changes, ...comments].sort((x, y) => x.at - y.at);
  });

  /** Every descendant as a tree in reading order: children of a task by number, under it. */
  protected readonly subtaskRows = computed<SubtaskRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    const byParent = new Map<string, Task[]>();
    for (const s of d.subtasks) byParent.set(s.parentId ?? '', [...(byParent.get(s.parentId ?? '') ?? []), s]);
    const out: SubtaskRow[] = [];
    const walk = (parentId: string, level: number): void => {
      for (const t of (byParent.get(parentId) ?? []).sort((a, b) => a.number - b.number)) {
        out.push({ task: t, level });
        walk(t.id, level + 1);
      }
    };
    walk(d.task.id, 0);
    return out;
  });
  protected readonly subtasksClosed = computed(() => (this.data()?.subtasks ?? []).filter((s) => s.statusType === 'CLOSED').length);

  constructor() {
    // The route reuses this component when a subtask or the parent task is opened: start over for the new task.
    effect(() => {
      const task = this.tid();
      untracked(() => {
        if (this.loadedFor !== null && this.loadedFor !== task) this.openTask(task);
      });
    });
  }

  private loadedFor: string | null = null;

  private openTask(task: string): void {
    this.loadedFor = task;
    this.data.set(null);
    this.parent.set(null);
    this.missing.set(false);
    this.error.set(null);
    this.notice.set(null);
    this.editTitle.set(false);
    this.editingComment.set(null);
    this.commentText.set('');
    void this.load();
  }

  ngOnInit(): void {
    this.loadedFor = this.tid();
    this.people.load();
    this.projectApi.get(this.id()).subscribe({ next: (p) => this.projectName.set(p.project.name), error: () => {} });
    this.taskApi.lists(this.id(), false).subscribe({ next: (l) => this.lists.set(l), error: () => {} });
    this.taskApi.tasks(this.id()).subscribe({
      next: (all) => this.projectTags.set([...new Set(all.flatMap((t) => t.tags))].sort()),
      error: () => {},
    });
    if (this.active.can('CUSTOM_FIELDS_VIEW')) {
      this.fieldApi.list('TASK').subscribe({
        next: (fields) => this.fieldLabels.set(Object.fromEntries(fields.map((f) => [f.apiName, f.label]))),
        error: () => {},
      });
    }
    void this.load();
  }

  protected statusIcon(t: Task): TvIcon {
    const s = this.data()?.statuses.find((x) => x.id === t.statusId);
    return { k: 'status', s: s ?? { color: t.statusColor, statusType: t.statusType, defaultStatus: false } };
  }

  protected ownerNames(t: Task): string[] {
    return t.ownerIds.map((id) => this.personName(id));
  }

  /** Subtask links stay in the panel when this is the peek. */
  protected subLink(event: Event, id: string): void {
    if (!this.compact()) return;
    event.preventDefault();
    this.subOpen.emit(id);
  }

  protected onKey(e: KeyboardEvent): void {
    if (!this.compact() && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette.set(true);
    }
  }

  /** The close-with-open-subtasks question, as a promise. */
  private askClose(key: string, open: number): Promise<boolean> {
    return new Promise((done) => this.closeAsk.set({ key, open, done }));
  }

  protected answerClose(ok: boolean): void {
    const a = this.closeAsk();
    this.closeAsk.set(null);
    a?.done(ok);
  }

  protected isOverdue(t: Task): boolean {
    return isOverdue(t);
  }

  protected dateTimePattern(): string {
    return `${this.active.portal()?.dateFormat ?? 'MMM d, yyyy'}, h:mm a`;
  }

  protected personName(userId: string | null | undefined): string {
    if (userId && userId === this.me()?.id) return this.me()?.fullName ?? 'You';
    return this.people.nameOf(userId);
  }

  private async load(): Promise<void> {
    try {
      const d = await firstValueFrom(this.taskApi.get(this.tid()));
      this.data.set(d);
      this.missing.set(false);
      if (d.task.parentId && this.parent()?.id !== d.task.parentId) {
        this.taskApi.get(d.task.parentId).subscribe({ next: (p) => this.parent.set(p.task), error: () => this.parent.set(null) });
      } else if (!d.task.parentId) {
        this.parent.set(null);
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'TASK_NOT_FOUND' || e.status === 404) this.missing.set(true);
      else this.error.set(e.message);
    }
  }

  /** Runs a change, shows what happened, then reloads (which also resets anything the server refused). */
  private async run(call: () => Promise<unknown>, notice: string | null = null): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    try {
      await call();
      if (notice) this.notice.set(notice);
    } catch (err) {
      this.error.set((err as ApiError).message);
    }
    await this.load();
  }

  private patchLocal(patch: Partial<Task>): void {
    this.data.update((cur) => (cur ? { ...cur, task: { ...cur.task, ...patch } } : cur));
  }

  /** Saves one standard property: only that property is sent (status goes through the status call). */
  protected readonly saveCore: SaveValue = async (apiName, value, optimistic) => {
    const t = this.task();
    if (!t) return;
    if (apiName === 'statusId') {
      const d = this.data();
      const target = d?.statuses.find((s) => s.id === value);
      const open = d ? d.subtasks.filter((s) => s.parentId === t.id && s.statusType !== 'CLOSED').length : 0;
      if (target?.statusType === 'CLOSED' && t.statusType !== 'CLOSED' && open > 0 && !(await this.askClose(t.key, open))) return false;
    }
    const previous = (t as unknown as Record<string, unknown>)[apiName];
    const local = apiName !== 'statusId' && apiName !== 'listId';
    if (optimistic && local) this.patchLocal({ [apiName]: value ?? (apiName === 'ownerIds' ? [] : null) } as Partial<Task>);
    try {
      if (apiName === 'statusId') await firstValueFrom(this.taskApi.changeStatus(t.id, String(value)));
      else await firstValueFrom(this.taskApi.update(t.id, { [apiName]: value } as TaskPatch));
    } catch (err) {
      if (optimistic && local) this.patchLocal({ [apiName]: previous } as Partial<Task>);
      throw propertyError(err, apiName);
    }
    await this.load();
    return undefined;
  };

  protected readonly saveDescription: SaveValue = async (_k, value) => {
    const t = this.task();
    if (!t) return;
    try {
      await firstValueFrom(this.taskApi.update(t.id, { description: (value as string | null) ?? null }));
    } catch (err) {
      throw propertyError(err, 'description');
    }
    await this.load();
  };

  /** Saves one custom answer: only that key is sent (the server merges by key). */
  protected readonly saveCustom: SaveValue = async (apiName, value, optimistic) => {
    const t = this.task();
    if (!t) return;
    const previous = t.customValues[apiName];
    const apply = (v: unknown): void => {
      const next = { ...t.customValues };
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete next[apiName];
      else next[apiName] = v;
      this.patchLocal({ customValues: next });
    };
    if (optimistic) apply(value);
    try {
      await firstValueFrom(this.taskApi.update(t.id, { customValues: { [apiName]: value } }));
    } catch (err) {
      if (optimistic) apply(previous);
      throw propertyError(err, apiName);
    }
    await this.load();
  };

  /* ---------- title ---------- */
  protected startTitle(): void {
    this.titleDraft.set(this.task()?.title ?? '');
    this.titleError.set(null);
    this.editTitle.set(true);
  }

  protected cancelTitle(): void {
    this.editTitle.set(false);
    this.titleError.set(null);
  }

  protected async saveTitle(): Promise<void> {
    const t = this.task();
    if (!t || !this.editTitle() || this.savingTitle) return;
    const title = this.titleDraft();
    if (title.trim() === t.title) {
      this.cancelTitle();
      return;
    }
    this.savingTitle = true;
    try {
      await firstValueFrom(this.taskApi.update(t.id, { title }));
      this.editTitle.set(false);
      this.titleError.set(null);
      await this.load();
    } catch (err) {
      this.titleError.set(propertyError(err, 'title').message);
    } finally {
      this.savingTitle = false;
    }
  }

  /* ---------- subtasks ---------- */
  protected async addSubtask(input: HTMLInputElement): Promise<void> {
    const t = this.task();
    const title = input.value;
    if (!t || !title.trim() || this.subBusy()) return;
    this.subBusy.set(true);
    this.subError.set(null);
    try {
      await firstValueFrom(this.taskApi.create(this.id(), { title, parentId: t.id }));
      input.value = '';
      await this.load();
    } catch (err) {
      const e = err as ApiError;
      const detail = e.details?.['title'] ?? e.details?.['parentId'];
      this.subError.set(typeof detail === 'string' ? detail : e.message);
    }
    this.subBusy.set(false);
    setTimeout(() => input.focus());
  }

  /* ---------- comments ---------- */
  protected async addComment(): Promise<void> {
    const t = this.task();
    if (!t || this.commentBusy()) return;
    this.commentBusy.set(true);
    this.commentError.set(null);
    try {
      await firstValueFrom(this.taskApi.addComment(t.id, this.commentText()));
      this.commentText.set('');
      await this.load();
    } catch (err) {
      this.commentError.set(propertyError(err, 'body').message);
    }
    this.commentBusy.set(false);
  }

  protected startEditComment(c: TaskComment): void {
    this.editingComment.set(c.id);
    this.editText.set(c.body);
    this.editError.set(null);
  }

  protected async saveComment(): Promise<void> {
    const id = this.editingComment();
    if (!id) return;
    try {
      await firstValueFrom(this.taskApi.updateComment(id, this.editText()));
      this.editingComment.set(null);
      this.editError.set(null);
      await this.load();
    } catch (err) {
      this.editError.set(propertyError(err, 'body').message);
    }
  }

  protected async removeComment(): Promise<void> {
    const c = this.deleteComment();
    if (!c) return;
    this.deleteComment.set(null);
    await this.run(() => firstValueFrom(this.taskApi.deleteComment(c.id)));
  }

  /* ---------- tags, followers ---------- */
  protected async addTag(input: HTMLInputElement): Promise<void> {
    const t = this.task();
    const value = input.value.trim();
    if (!t || !value) return;
    this.tagError.set(null);
    try {
      await firstValueFrom(this.taskApi.update(t.id, { tags: [...t.tags, value] }));
      input.value = '';
      if (!this.projectTags().some((x) => x.toLowerCase() === value.toLowerCase())) this.projectTags.update((l) => [...l, value]);
      await this.load();
    } catch (err) {
      this.tagError.set(propertyError(err, 'tags').message);
    }
    setTimeout(() => input.focus());
  }

  protected removeTag(tag: string): void {
    const t = this.task();
    if (!t) return;
    void this.run(() => firstValueFrom(this.taskApi.update(t.id, { tags: t.tags.filter((x) => x !== tag) })));
  }

  protected toggleFollow(): void {
    const t = this.task();
    const me = this.me();
    if (!t || !me) return;
    const was = this.following();
    void this.run(
      () => firstValueFrom(was ? this.taskApi.removeFollower(t.id, me.id) : this.taskApi.addFollower(t.id, me.id)),
      was ? 'You unfollowed this task.' : 'You follow this task.',
    );
  }

  protected addFollower(userId: string): void {
    const t = this.task();
    if (t && userId) void this.run(() => firstValueFrom(this.taskApi.addFollower(t.id, userId)));
  }

  protected removeFollower(userId: string): void {
    const t = this.task();
    if (t) void this.run(() => firstValueFrom(this.taskApi.removeFollower(t.id, userId)));
  }

  /* ---------- trash ---------- */
  protected async moveToTrash(): Promise<void> {
    const t = this.task();
    if (!t) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.taskApi.trash(t.id));
      const back = this.back();
      if (this.compact()) {
        this.trashed.emit(`${t.key} moved to the trash.`);
        return;
      }
      await this.router.navigate(back.link, {
        queryParams: back.query,
        state: { notice: `${t.key} moved to the trash.` },
      });
    } catch (err) {
      this.busy.set(false);
      this.confirmTrash.set(false);
      this.error.set((err as ApiError).message);
    }
  }

  /* ---------- activity ---------- */
  protected activityLabel(a: TaskActivity): string {
    const c = COMMENT_ACTIONS[a.action];
    if (c) return c;
    switch (a.action) {
      case 'TASK_CREATED':
        return 'created this task';
      case 'TASK_TRASHED':
        return 'moved this task to the trash';
      case 'TASK_RESTORED':
        return 'restored this task';
      default:
        return a.action.toLowerCase().replaceAll('_', ' ');
    }
  }

  protected fieldLabel(key: string): string {
    if (key.startsWith('customValues.')) {
      const api = key.slice('customValues.'.length);
      return this.fieldLabels()[api] ?? api;
    }
    return key === 'statusId' ? 'status' : (FIELD_LABELS[key] ?? key);
  }

  /** A stored value as text: ids of people become names, plain dates the portal's format. */
  protected activityValue(key: string, v: string | null): string {
    if (v === null || v === '') return 'nothing';
    if (key === 'ownerIds' || key === 'followerIds') return v.split(', ').map((id) => this.personName(id)).join(', ');
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? this.dayPipe.transform(v) : v;
  }
}

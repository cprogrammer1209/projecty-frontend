import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { LayoutField, LayoutSection } from '../../core/customfield/layout.api';
import {
  ProjectApi,
  ProjectDetail,
  ProjectPatch,
  ProjectRole,
  ProjectStatus as ProjectStatusItem,
} from '../../core/project/project.api';
import { Task, TaskApi } from '../../core/task/task.api';
import { isOverdue } from '../tasks/task-ui';
import { ProjectTabs } from '../tasks/project-tabs';
import { PyDatePipe } from '../../shared/pipes/py-date.pipe';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';
import { takeNavigationNotice } from './navigation-notice';
import { ACTIVITY_LABELS } from './project-labels';
import { ProjectStatus } from './project-status';
import { PropertyList, SaveValue } from './property-list';

/**
 * A project's overview (PRJ-US-04, 05, 06, 07): status, members, recent activity, delete. Progress and task counts
 * are placeholders until tasks exist. What the caller may change comes from the server (`canEdit`, `canDelete`).
 */
@Component({
  selector: 'py-project-overview',
  imports: [RouterLink, PyDatePipe, PyDayPipe, Icon, ProjectStatus, PropertyList, ProjectTabs],
  templateUrl: './project-overview.html',
  styleUrl: './projects.scss',
})
export class ProjectOverview implements OnInit {
  /** The project id from the route. */
  readonly id = input.required<string>();

  private readonly projectApi = inject(ProjectApi);
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApi);
  protected readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  protected readonly detail = signal<ProjectDetail | null>(null);
  /** Every task of the project (null until loaded, or when the caller can't see tasks). */
  protected readonly tasks = signal<Task[] | null>(null);
  protected readonly taskStats = computed(() => {
    const all = this.tasks();
    if (!all) return null;
    const open = all.filter((t) => t.statusType === 'OPEN');
    return { total: all.length, open: open.length, closed: all.length - open.length, overdue: open.filter((t) => isOverdue(t)).length };
  });
  protected readonly statuses = signal<ProjectStatusItem[]>([]);
  protected readonly missing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(takeNavigationNotice());
  protected readonly busy = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly addUserId = signal('');
  protected readonly addRole = signal<ProjectRole>('MEMBER');
  protected readonly initials = initials;
  protected readonly activityLabels = ACTIVITY_LABELS;

  /** People of the portal who are not in this project yet. */
  protected readonly freePeople = computed(() => {
    const inProject = new Set((this.detail()?.members ?? []).map((m) => m.userId));
    return this.people.activeMembers().filter((m) => !inProject.has(m.userId));
  });

  protected progressOf(s: { total: number; closed: number }): number {
    return Math.round((s.closed * 100) / s.total);
  }

  /** Collapsed sections, remembered per person in this browser: { "<layoutId>:<sectionId>": true }. */
  private readonly collapsedKey = 'py-cf-collapsed';
  private readonly collapsedMap = signal<Record<string, boolean>>(this.readCollapsed());

  /** Only the sections of the project's layout that have a visible field. */
  protected readonly sections = computed(() => (this.detail()?.layout.sections ?? []).filter((s) => s.fields.length));
  
  /** The properties every project has, as pickers for the Details card (a property's name is its key in an update). */
  protected readonly detailFields = computed<LayoutField[]>(() => {
    const field = (apiName: string, label: string, fieldType: LayoutField['fieldType'], extra: Partial<LayoutField> = {}): LayoutField => ({
      fieldId: apiName, apiName, label, description: null, fieldType, mandatory: false, fieldMandatory: false, readOnly: false,
      wide: false, unique: false, sensitive: false, defaultValue: null, config: {}, options: [], ...extra,
    });
    return [
      field('name', 'Name', 'TEXT', { mandatory: true, config: { maxLength: 100 } }),
      field('ownerUserId', 'Owner', 'USER', { mandatory: true }),
      field('startDate', 'Start date', 'DATE'),
      field('endDate', 'End date', 'DATE'),
      field('visibility', 'Who can see it', 'PICKLIST', {
        mandatory: true,
        options: [
          { id: 'PRIVATE', label: 'Private: only members and Admins', color: null, sortOrder: 1, defaultOption: false, active: true },
          { id: 'PUBLIC', label: 'Public: every employee, read-only', color: null, sortOrder: 2, defaultOption: false, active: true },
        ],
      }),
      field('description', 'Description', 'LONG_TEXT', { wide: true, config: { maxLength: 5000 } }),
    ];
  });

  protected readonly detailValues = computed<Record<string, unknown>>(() => {
    const p = this.detail()?.project;
    return p ? { name: p.name, ownerUserId: p.ownerUserId, startDate: p.startDate, endDate: p.endDate, visibility: p.visibility, description: p.description } : {};
  });

  /** Saves one custom answer: only that key is sent (the server merges by key). */
  protected readonly saveValue: SaveValue = async (apiName, value, optimistic) => {
    const d = this.detail();
    if (!d) return;
    const previous = d.project.customValues[apiName];
    if (optimistic) this.applyValue(apiName, value);
    try {
      const saved = await firstValueFrom(this.projectApi.update(this.id(), { customValues: { [apiName]: value } }));
      this.applyValue(apiName, saved.customValues?.[apiName] ?? value);
    } catch (err) {
      if (optimistic) this.applyValue(apiName, previous);
      throw this.fieldError(err, apiName);
    }
    this.refreshActivity();
  };

  /** Saves one core property (name, owner, a date, who can see it, description): only that property is sent. */
  protected readonly saveCore: SaveValue = async (property, value, optimistic) => {
    const d = this.detail();
    if (!d) return;
    const previous = (d.project as unknown as Record<string, unknown>)[property];
    if (optimistic) this.applyCore(property, value);
    try {
      const saved = await firstValueFrom(this.projectApi.update(this.id(), { [property]: value } as ProjectPatch));
      this.applyCore(property, (saved as unknown as Record<string, unknown>)[property] ?? null);
    } catch (err) {
      if (optimistic) this.applyCore(property, previous);
      throw this.fieldError(err, property);
    }
    this.refreshActivity();
  };

  /** The message to show under a value: the server's note for that property, else its general message. */
  private fieldError(err: unknown, key: string): Error {
    const e = err as ApiError;
    const detail = e.details?.[key];
    return new Error(typeof detail === 'string' ? detail : e.message);
  }

  private applyCore(property: string, value: unknown): void {
    this.detail.update((cur) => (cur ? { ...cur, project: { ...cur.project, [property]: value } } : cur));
  }

  private refreshActivity(): void {
    this.projectApi.get(this.id()).subscribe({
      next: (fresh) => this.detail.update((cur) => (cur ? { ...cur, activity: fresh.activity } : cur)),
      error: () => {},
    });
  }

  protected isCollapsed(section: LayoutSection): boolean {
    const d = this.detail();
    return !!d && section.collapsible && !!this.collapsedMap()[`${d.layout.id}:${section.id}`];
  }

  protected toggleSection(section: LayoutSection): void {
    const d = this.detail();
    if (!d) return;
    const key = `${d.layout.id}:${section.id}`;
    const next = { ...this.collapsedMap(), [key]: !this.collapsedMap()[key] };
    this.collapsedMap.set(next);
    try {
      localStorage.setItem(this.collapsedKey, JSON.stringify(next));
    } catch {
      /* not remembered */
    }
  }

  private readCollapsed(): Record<string, boolean> {
    try {
      const raw = JSON.parse(localStorage.getItem(this.collapsedKey) ?? 'null') as Record<string, boolean> | null;
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  private applyValue(apiName: string, value: unknown): void {
    this.detail.update((cur) => {
      if (!cur) return cur;
      const next = { ...cur.project.customValues };
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete next[apiName];
      else next[apiName] = value;
      return { ...cur, project: { ...cur.project, customValues: next } };
    });
  }

  ngOnInit(): void {
    this.people.load();
    this.projectApi.statuses().subscribe({ next: (list) => this.statuses.set(list), error: () => {} });
    this.load();
    if (this.active.can('TASKS_VIEW')) {
      this.taskApi.tasks(this.id()).subscribe({ next: (list) => this.tasks.set(list), error: () => {} });
    }
  }

  protected dateTimePattern(): string {
    return `${this.active.portal()?.dateFormat ?? 'MMM d, yyyy'}, h:mm a`;
  }

  protected onStatus(event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    this.run(this.projectApi.changeStatus(this.id(), status), `Status changed to ${status}.`);
  }

  protected onAddUser(event: Event): void {
    this.addUserId.set((event.target as HTMLSelectElement).value);
  }

  protected onAddRole(event: Event): void {
    this.addRole.set((event.target as HTMLSelectElement).value as ProjectRole);
  }

  protected addMember(): void {
    if (this.addUserId()) {
      this.run(this.projectApi.addMember(this.id(), this.addUserId(), this.addRole()), 'Member added.');
    }
  }

  protected removeMember(userId: string): void {
    this.run(this.projectApi.removeMember(this.id(), userId), 'Member removed.');
  }

  protected deleteProject(): void {
    const name = this.detail()?.project.name ?? 'The project';
    this.busy.set(true);
    this.projectApi.moveToTrash(this.id()).subscribe({
      next: () =>
        this.router.navigate(['/p', this.active.portal()?.slug, 'projects'], {
          state: { notice: `${name} moved to the trash.` },
        }),
      error: (err: ApiError) => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.error.set(err.message);
      },
    });
  }

  private load(): void {
    this.projectApi.get(this.id()).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (err: ApiError) => {
        if (err.code === 'PROJECT_NOT_FOUND') {
          this.missing.set(true);
        } else {
          this.error.set(err.message);
        }
      },
    });
  }

  /** Runs a change, shows what happened, then reloads (which also resets a select the server refused). */
  private run(call: Observable<unknown>, notice: string): void {
    this.error.set(null);
    this.notice.set(null);
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(notice);
        this.addUserId.set('');
        this.load();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.error.set(err.message);
        this.load();
      },
    });
  }
}

import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import {
  ProjectApi,
  ProjectDetail,
  ProjectRole,
  ProjectStatus as ProjectStatusItem,
} from '../../core/project/project.api';
import { PyDatePipe } from '../../shared/pipes/py-date.pipe';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';
import { takeNavigationNotice } from './navigation-notice';
import { ACTIVITY_LABELS } from './project-labels';
import { ProjectStatus } from './project-status';

/**
 * A project's overview (PRJ-US-04, 05, 06, 07): status, members, recent activity, delete. Progress and task counts
 * are placeholders until tasks exist. What the caller may change comes from the server (`canEdit`, `canDelete`).
 */
@Component({
  selector: 'py-project-overview',
  imports: [RouterLink, PyDatePipe, PyDayPipe, Icon, ProjectStatus],
  templateUrl: './project-overview.html',
  styleUrl: './projects.scss',
})
export class ProjectOverview implements OnInit {
  /** The project id from the route. */
  readonly id = input.required<string>();

  private readonly projectApi = inject(ProjectApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  protected readonly detail = signal<ProjectDetail | null>(null);
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

  ngOnInit(): void {
    this.people.load();
    this.projectApi.statuses().subscribe({ next: (list) => this.statuses.set(list), error: () => {} });
    this.load();
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

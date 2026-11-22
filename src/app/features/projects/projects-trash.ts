import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../core/api/api.types';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { Project, ProjectApi } from '../../core/project/project.api';
import { PyDatePipe } from '../../shared/pipes/py-date.pipe';
import { Icon } from '../../shared/ui/icon/icon';

/** Deleted projects the caller owns or, as an Admin, in the portal; restoring brings back everything in them. */
@Component({
  selector: 'py-projects-trash',
  imports: [RouterLink, PyDatePipe, Icon],
  templateUrl: './projects-trash.html',
  styleUrl: './projects.scss',
})
export class ProjectsTrash implements OnInit {
  private readonly projectApi = inject(ProjectApi);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  protected readonly projects = signal<Project[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.people.load();
    this.load();
  }

  protected dateTimePattern(): string {
    return `${this.active.portal()?.dateFormat ?? 'MMM d, yyyy'}, h:mm a`;
  }

  protected restore(project: Project): void {
    this.error.set(null);
    this.notice.set(null);
    this.busyId.set(project.id);
    this.projectApi.restore(project.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(`${project.name} restored.`);
        this.load();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.error.set(err.message);
      },
    });
  }

  private load(): void {
    this.projectApi.listTrash().subscribe({
      next: (list) => this.projects.set(list),
      error: (err: ApiError) => {
        this.projects.set([]);
        this.error.set(err.message);
      },
    });
  }
}

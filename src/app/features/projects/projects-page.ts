import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/api/api.types';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { Project, ProjectApi, ProjectStatus as ProjectStatusItem } from '../../core/project/project.api';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';
import { takeNavigationNotice } from './navigation-notice';
import { ProjectStatus } from './project-status';

type SortKey = 'name' | 'key' | 'end' | 'status';

/** Projects the caller may see in this portal (PRJ-US-03): search, filter by status and owner, sort. */
@Component({
  selector: 'py-projects-page',
  imports: [RouterLink, PyDayPipe, Icon, ProjectStatus],
  templateUrl: './projects-page.html',
  styleUrl: './projects.scss',
})
export class ProjectsPage implements OnInit {
  private readonly projectApi = inject(ProjectApi);
  private readonly router = inject(Router);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  protected readonly canCreate = this.active.can('PROJECTS_CREATE');
  protected readonly canTrash = this.active.can('PROJECTS_DELETE');
  protected readonly projects = signal<Project[] | null>(null);
  protected readonly statuses = signal<ProjectStatusItem[]>([]);
  protected readonly query = signal('');
  protected readonly status = signal('ALL');
  protected readonly owner = signal('ALL');
  protected readonly sort = signal<SortKey>('name');
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(takeNavigationNotice());
  protected readonly initials = initials;

  /** Owners that appear in the list, for the owner filter. */
  protected readonly owners = computed(() => {
    const ids = [...new Set((this.projects() ?? []).map((p) => p.ownerUserId))];
    return ids.map((id) => ({ id, name: this.people.nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const compare: Record<SortKey, (a: Project, b: Project) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      key: (a, b) => a.key.localeCompare(b.key),
      end: (a, b) => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'),
      status: (a, b) => a.status.localeCompare(b.status),
    };
    return (this.projects() ?? [])
      .filter(
        (p) =>
          (this.status() === 'ALL' || p.status === this.status()) &&
          (this.owner() === 'ALL' || p.ownerUserId === this.owner()) &&
          (!q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)),
      )
      .sort(compare[this.sort()]);
  });

  protected readonly filtering = computed(() => !!this.query() || this.status() !== 'ALL' || this.owner() !== 'ALL');

  ngOnInit(): void {
    this.people.load();
    this.projectApi.statuses().subscribe({ next: (list) => this.statuses.set(list), error: () => {} });
    this.projectApi.list().subscribe({
      next: (list) => this.projects.set(list),
      error: (err: ApiError) => {
        this.projects.set([]);
        this.error.set(err.message);
      },
    });
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value);
  }

  protected onOwner(event: Event): void {
    this.owner.set((event.target as HTMLSelectElement).value);
  }

  protected onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as SortKey);
  }

  protected open(project: Project): void {
    this.router.navigate(['/p', this.active.portal()?.slug, 'projects', project.id]);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';

export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';
export type ProjectRole = 'MANAGER' | 'MEMBER';

/** A project as the caller may see it. `canEdit` and `canDelete` say which actions to show; the server still checks. */
export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  status: string;
  /** Plain dates (yyyy-MM-dd), not instants. */
  startDate: string | null;
  endDate: string | null;
  visibility: ProjectVisibility;
  ownerUserId: string;
  memberCount: number;
  /** 0 until tasks exist. */
  progress: number;
  member: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  /** Set only for projects in the trash. */
  deletedAt: string | null;
  deletedByUserId: string | null;
}

/** Work stores only the user id; names come from the portal's people (PortalPeople). */
export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  owner: boolean;
}

export interface ProjectActivity {
  action: string;
  actorUserId: string;
  actorName: string | null;
  targetUserId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface ProjectDetail {
  project: Project;
  members: ProjectMember[];
  activity: ProjectActivity[];
}

export interface ProjectStatus {
  name: string;
  /** Active, On hold, Completed or Cancelled. */
  type: string;
}

/** What the create form sends. A null owner means the caller; null dates mean "not set". */
export interface ProjectInput {
  name: string;
  key: string;
  ownerUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  visibility: ProjectVisibility;
  description: string;
}

/** The key never changes after creation, so edits don't send it. */
export type ProjectUpdate = Omit<ProjectInput, 'key'>;

/** The Work service: projects of the active portal (X-Portal-Id). Served under /api/work. */
@Injectable({ providedIn: 'root' })
export class ProjectApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Project[]> {
    return this.http.get<AppResponse<Project[]>>('/api/work/projects').pipe(unwrap());
  }

  listTrash(): Observable<Project[]> {
    return this.http.get<AppResponse<Project[]>>('/api/work/projects/trash').pipe(unwrap());
  }

  get(id: string): Observable<ProjectDetail> {
    return this.http.get<AppResponse<ProjectDetail>>(`/api/work/projects/${id}`).pipe(unwrap());
  }

  create(input: ProjectInput): Observable<{ id: string }> {
    return this.http.post<AppResponse<{ id: string }>>('/api/work/projects', input).pipe(unwrap());
  }

  update(id: string, input: ProjectUpdate): Observable<Project> {
    return this.http.patch<AppResponse<Project>>(`/api/work/projects/${id}`, input).pipe(unwrap());
  }

  changeStatus(id: string, status: string): Observable<Project> {
    return this.http.post<AppResponse<Project>>(`/api/work/projects/${id}/status`, { status }).pipe(unwrap());
  }

  moveToTrash(id: string): Observable<void> {
    return this.http.delete<AppResponse<void>>(`/api/work/projects/${id}`).pipe(unwrap());
  }

  restore(id: string): Observable<Project> {
    return this.http.post<AppResponse<Project>>(`/api/work/projects/${id}/restore`, null).pipe(unwrap());
  }

  addMember(id: string, userId: string, role: ProjectRole): Observable<ProjectMember[]> {
    return this.http
      .post<AppResponse<ProjectMember[]>>(`/api/work/projects/${id}/members`, { userId, role })
      .pipe(unwrap());
  }

  removeMember(id: string, userId: string): Observable<ProjectMember[]> {
    return this.http.delete<AppResponse<ProjectMember[]>>(`/api/work/projects/${id}/members/${userId}`).pipe(unwrap());
  }

  keyAvailability(key: string): Observable<{ available: boolean }> {
    return this.http
      .get<AppResponse<{ available: boolean }>>('/api/work/projects/key-availability', { params: { key } })
      .pipe(unwrap());
  }

  statuses(): Observable<ProjectStatus[]> {
    return this.http.get<AppResponse<ProjectStatus[]>>('/api/work/project-statuses').pipe(unwrap());
  }
}

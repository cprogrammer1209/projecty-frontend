import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';
import { Layout } from '../customfield/layout.api';
import { ProjectDetail } from '../project/project.api';

export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StatusType = 'OPEN' | 'CLOSED';
export type ListVisibility = 'INTERNAL' | 'EXTERNAL';

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  visibility: ListVisibility;
  sortOrder: number;
  archived: boolean;
  taskCount: number;
  completedCount: number;
  createdAt: string;
}

/** One status of a task layout. */
export interface LayoutStatus {
  id: string;
  name: string;
  statusType: StatusType;
  color: string | null;
  sortOrder: number;
  defaultStatus: boolean;
}

/** A task layout as the server resolves it: the usual layout plus its statuses. */
export type TaskLayout = Layout & { statuses: LayoutStatus[] };

export interface Task {
  id: string;
  projectId: string;
  projectKey: string;
  key: string;
  number: number;
  listId: string;
  listName: string;
  parentId: string | null;
  /** 1 = top level, 5 at most. */
  depth: number;
  title: string;
  description: string | null;
  statusId: string;
  statusName: string;
  statusType: StatusType;
  statusColor: string | null;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  workHours: number | null;
  completion: number;
  ownerIds: string[];
  followerIds: string[];
  tags: string[];
  customValues: Record<string, unknown>;
  layoutId: string;
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
  closedAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  deletedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface TaskActivity {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
  actorUserId: string;
  actorName: string | null;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorUserId: string;
  authorName: string | null;
  body: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface TaskDetail {
  task: Task;
  layout: TaskLayout;
  /** Answers of active fields the layout does not show: kept, and shown again if a layout has them. */
  hiddenValues: Record<string, unknown>;
  statuses: LayoutStatus[];
  /** Every descendant, flat, by depth then number; `parentId` builds the tree. */
  subtasks: Task[];
  activity: TaskActivity[];
  comments: TaskComment[];
  followers: string[];
}

export interface TaskFilter {
  listId?: string;
  status?: string;
  statusType?: StatusType | '';
  ownerId?: string;
  priority?: TaskPriority | '';
  q?: string;
  parentId?: string;
  trashed?: boolean;
}

/** A row of the portal-wide list: a task plus the name of its project. */
export interface PortalTask extends Task {
  projectName: string;
}

/** The query of `GET /api/work/tasks`; empty values are left out. */
export interface PortalTaskFilter {
  scope?: 'mine' | 'all';
  projectId?: string;
  statusType?: StatusType | '';
  ownerId?: string;
  priority?: TaskPriority | '';
  q?: string;
  dueBefore?: string;
  dueAfter?: string;
  limit?: number;
  cursor?: string;
}

/** One page of the portal-wide list; `total` counts every match the caller may see. */
export interface PortalTaskPage {
  items: PortalTask[];
  nextCursor: string | null;
  total: number;
}

/** What quick add and create send; only the title is needed. */
export interface TaskInput {
  title: string;
  listId?: string | null;
  parentId?: string | null;
  statusId?: string | null;
  priority?: TaskPriority;
  description?: string | null;
  dueDate?: string | null;
  ownerIds?: string[];
  tags?: string[];
}

/**
 * What an update sends. Partial by presence: only the properties present change, `null` clears the optional ones.
 * `customValues` merges by key.
 */
export interface TaskPatch {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  workHours?: number | string | null;
  completion?: number | string;
  ownerIds?: string[] | null;
  tags?: string[] | null;
  statusId?: string;
  listId?: string;
  parentId?: string | null;
  customValues?: Record<string, unknown>;
}

const BASE = '/api/work';

/** The Work service: task lists, tasks and comments of the active portal (X-Portal-Id). */
@Injectable({ providedIn: 'root' })
export class TaskApi {
  private readonly http = inject(HttpClient);

  lists(projectId: string, includeArchived = true): Observable<TaskList[]> {
    return this.http
      .get<AppResponse<TaskList[]>>(`${BASE}/projects/${projectId}/task-lists`, { params: { includeArchived } })
      .pipe(unwrap());
  }

  createList(projectId: string, input: { name: string; visibility: ListVisibility }): Observable<TaskList> {
    return this.http.post<AppResponse<TaskList>>(`${BASE}/projects/${projectId}/task-lists`, input).pipe(unwrap());
  }

  updateList(id: string, patch: { name?: string; visibility?: ListVisibility }): Observable<TaskList> {
    return this.http.patch<AppResponse<TaskList>>(`${BASE}/task-lists/${id}`, patch).pipe(unwrap());
  }

  archiveList(id: string, archive: boolean): Observable<TaskList> {
    return this.http
      .post<AppResponse<TaskList>>(`${BASE}/task-lists/${id}/${archive ? 'archive' : 'unarchive'}`, null)
      .pipe(unwrap());
  }

  orderLists(projectId: string, ids: string[]): Observable<TaskList[]> {
    return this.http.put<AppResponse<TaskList[]>>(`${BASE}/projects/${projectId}/task-lists/order`, { ids }).pipe(unwrap());
  }

  tasks(projectId: string, filter: TaskFilter = {}): Observable<Task[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
    }
    return this.http.get<AppResponse<Task[]>>(`${BASE}/projects/${projectId}/tasks`, { params }).pipe(unwrap());
  }

  /** The Tasks module: tasks of every project the caller may see (TASKS_VIEW), one page at a time. */
  listAll(filter: PortalTaskFilter = {}): Observable<PortalTaskPage> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
    }
    return this.http.get<AppResponse<PortalTaskPage>>(`${BASE}/tasks`, { params }).pipe(unwrap());
  }

  create(projectId: string, input: TaskInput): Observable<Task> {
    return this.http.post<AppResponse<Task>>(`${BASE}/projects/${projectId}/tasks`, input).pipe(unwrap());
  }

  get(id: string): Observable<TaskDetail> {
    return this.http.get<AppResponse<TaskDetail>>(`${BASE}/tasks/${id}`).pipe(unwrap());
  }

  update(id: string, patch: TaskPatch): Observable<Task> {
    return this.http.patch<AppResponse<Task>>(`${BASE}/tasks/${id}`, patch).pipe(unwrap());
  }

  changeStatus(id: string, statusId: string): Observable<Task> {
    return this.http.post<AppResponse<Task>>(`${BASE}/tasks/${id}/status`, { statusId }).pipe(unwrap());
  }

  trash(id: string): Observable<void> {
    return this.http.delete<AppResponse<void>>(`${BASE}/tasks/${id}`).pipe(unwrap());
  }

  restore(id: string): Observable<Task> {
    return this.http.post<AppResponse<Task>>(`${BASE}/tasks/${id}/restore`, null).pipe(unwrap());
  }

  addFollower(id: string, userId: string): Observable<Task> {
    return this.http.post<AppResponse<Task>>(`${BASE}/tasks/${id}/followers/${userId}`, null).pipe(unwrap());
  }

  removeFollower(id: string, userId: string): Observable<Task> {
    return this.http.delete<AppResponse<Task>>(`${BASE}/tasks/${id}/followers/${userId}`).pipe(unwrap());
  }

  addComment(id: string, body: string): Observable<TaskComment> {
    return this.http.post<AppResponse<TaskComment>>(`${BASE}/tasks/${id}/comments`, { body }).pipe(unwrap());
  }

  updateComment(id: string, body: string): Observable<TaskComment> {
    return this.http.patch<AppResponse<TaskComment>>(`${BASE}/task-comments/${id}`, { body }).pipe(unwrap());
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<AppResponse<void>>(`${BASE}/task-comments/${id}`).pipe(unwrap());
  }

  /** A project's task layout (PROJECTS_EDIT). */
  setProjectTaskLayout(projectId: string, layoutId: string): Observable<ProjectDetail> {
    return this.http.put<AppResponse<ProjectDetail>>(`${BASE}/projects/${projectId}/task-layout`, { layoutId }).pipe(unwrap());
  }
}

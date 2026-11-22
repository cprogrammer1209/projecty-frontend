import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';

/** One audited action in the active portal (the backend's AuditEventResponseDTO). */
export interface AuditEvent {
  id: string;
  occurredAt: string;
  category: string;
  action: string;
  /** USER, or ADMIN for platform support acting in the portal. */
  actorType: 'USER' | 'ADMIN';
  actorName: string | null;
  targetName: string | null;
  detail: string | null;
}

/** The backend's PagedResponse; `page` is 0-based. */
export interface Paged<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditQuery {
  action?: string;
  page: number;
  size: number;
}

/** The audit module: the active portal's log (X-Portal-Id). Needs AUDIT_VIEW. */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  events(query: AuditQuery): Observable<Paged<AuditEvent>> {
    const params: Record<string, string> = { page: String(query.page), size: String(query.size) };
    if (query.action) {
      params['action'] = query.action;
    }
    return this.http.get<AppResponse<Paged<AuditEvent>>>('/api/audit-events', { params }).pipe(unwrap());
  }
}

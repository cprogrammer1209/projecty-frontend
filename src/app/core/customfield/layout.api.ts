import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';
import { CustomField, CustomFieldOption, EntityType, FieldType } from './custom-field.api';

/** One status of a TASK layout. Open means still being worked on, Closed means done. */
export interface LayoutStatus {
  id: string;
  name: string;
  statusType: 'OPEN' | 'CLOSED';
  color: string | null;
  sortOrder: number;
  defaultStatus: boolean;
}

/** A field as a layout shows it: the field's definition with the layout's rules already applied. */
export interface LayoutField {
  fieldId: string;
  apiName: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  /** Effective: the layout's override beats the field's own flag. */
  mandatory: boolean;
  /** What the field itself says, so a screen can show "same as the field". */
  fieldMandatory: boolean;
  readOnly: boolean;
  /** Effective width: true takes the whole row of the section's column grid. */
  wide: boolean;
  unique: boolean;
  sensitive: boolean;
  /** Effective default (an option id for a picklist). */
  defaultValue: unknown;
  config: Record<string, unknown>;
  options: CustomFieldOption[];
}

export interface LayoutSection {
  id: string;
  name: string;
  collapsible: boolean;
  /** Active fields only, in display order. */
  fields: LayoutField[];
}

/** A layout ready to draw a form. */
export interface Layout {
  id: string;
  entityType: EntityType;
  name: string;
  description: string | null;
  defaultLayout: boolean;
  active: boolean;
  sections: LayoutSection[];
  /** TASK layouts only. */
  statuses?: LayoutStatus[];
}

/** One row of the layouts list. `usage` is how many records use the layout. */
export interface LayoutSummary {
  id: string;
  entityType: EntityType;
  name: string;
  description: string | null;
  defaultLayout: boolean;
  active: boolean;
  sectionCount: number;
  fieldCount: number;
  usage: number;
}

/** A placed field exactly as stored: what the layout builder edits. Null mandatory or wide = as the field says. */
export interface LayoutPlacement {
  apiName: string;
  mandatory: boolean | null;
  readOnly: boolean;
  defaultValue: unknown;
  wide: boolean | null;
}

export interface LayoutEditorSection {
  id: string;
  name: string;
  collapsible: boolean;
  fields: LayoutPlacement[];
}

/** The layout as stored, plus every non-deleted field of the module (so unplaced ones can be offered). */
export interface LayoutEditor {
  id: string;
  entityType: EntityType;
  name: string;
  description: string | null;
  defaultLayout: boolean;
  active: boolean;
  usage: number;
  sections: LayoutEditorSection[];
  fields: CustomField[];
  /** TASK layouts only. */
  statuses?: LayoutStatus[];
}

/** What Save sends: the whole layout replaces the stored one. Section ids are not sent (the server assigns them). */
export interface LayoutUpdate {
  name: string;
  description: string | null;
  sections: { name: string; collapsible: boolean; fields: LayoutPlacement[] }[];
}

/** The Work service: layouts of the active portal (X-Portal-Id). Served under /api/work/layouts. */
@Injectable({ providedIn: 'root' })
export class LayoutApi {
  private readonly http = inject(HttpClient);

  list(entityType: EntityType = 'PROJECT'): Observable<LayoutSummary[]> {
    return this.http
      .get<AppResponse<LayoutSummary[]>>('/api/work/layouts', { params: { entityType } })
      .pipe(unwrap());
  }

  /** Active layouts, default first: what a "choose a layout" picker offers. */
  active(entityType: EntityType = 'PROJECT'): Observable<Layout[]> {
    return this.http
      .get<AppResponse<Layout[]>>('/api/work/layouts/active', { params: { entityType } })
      .pipe(unwrap());
  }

  /** For the builder (needs CUSTOM_FIELDS_MANAGE). */
  editor(id: string): Observable<LayoutEditor> {
    return this.http.get<AppResponse<LayoutEditor>>(`/api/work/layouts/${id}`).pipe(unwrap());
  }

  create(input: { entityType: EntityType; name: string; description?: string | null; cloneFromId?: string | null }): Observable<LayoutSummary> {
    return this.http.post<AppResponse<LayoutSummary>>('/api/work/layouts', input).pipe(unwrap());
  }

  update(id: string, input: LayoutUpdate): Observable<LayoutEditor> {
    return this.http.put<AppResponse<LayoutEditor>>(`/api/work/layouts/${id}`, input).pipe(unwrap());
  }

  makeDefault(id: string): Observable<LayoutSummary> {
    return this.http.post<AppResponse<LayoutSummary>>(`/api/work/layouts/${id}/default`, null).pipe(unwrap());
  }

  activate(id: string): Observable<LayoutSummary> {
    return this.http.post<AppResponse<LayoutSummary>>(`/api/work/layouts/${id}/activate`, null).pipe(unwrap());
  }

  /** Statuses of a TASK layout, in order (CUSTOM_FIELDS_VIEW). */
  statuses(layoutId: string): Observable<LayoutStatus[]> {
    return this.http.get<AppResponse<LayoutStatus[]>>(`/api/work/layouts/${layoutId}/statuses`).pipe(unwrap());
  }

  addStatus(layoutId: string, input: { name: string; statusType: 'OPEN' | 'CLOSED'; color?: string | null }): Observable<LayoutStatus[]> {
    return this.http.post<AppResponse<LayoutStatus[]>>(`/api/work/layouts/${layoutId}/statuses`, input).pipe(unwrap());
  }

  /** Partial: only the properties given change. A colour of "" clears it. */
  updateStatus(
    layoutId: string,
    statusId: string,
    input: { name?: string; statusType?: 'OPEN' | 'CLOSED'; color?: string; defaultStatus?: true },
  ): Observable<LayoutStatus[]> {
    return this.http
      .patch<AppResponse<LayoutStatus[]>>(`/api/work/layouts/${layoutId}/statuses/${statusId}`, input)
      .pipe(unwrap());
  }

  deleteStatus(layoutId: string, statusId: string): Observable<LayoutStatus[]> {
    return this.http.delete<AppResponse<LayoutStatus[]>>(`/api/work/layouts/${layoutId}/statuses/${statusId}`).pipe(unwrap());
  }

  orderStatuses(layoutId: string, ids: string[]): Observable<LayoutStatus[]> {
    return this.http.put<AppResponse<LayoutStatus[]>>(`/api/work/layouts/${layoutId}/statuses/order`, { ids }).pipe(unwrap());
  }

  deactivate(id: string): Observable<LayoutSummary> {
    return this.http.post<AppResponse<LayoutSummary>>(`/api/work/layouts/${id}/deactivate`, null).pipe(unwrap());
  }
}

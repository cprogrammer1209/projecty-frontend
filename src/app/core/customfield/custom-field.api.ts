import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';

/** The module a field belongs to. Projects today; tasks and others later. */
export type EntityType = 'PROJECT' | 'TASK';

export type FieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'DATE'
  | 'CHECKBOX'
  | 'PICKLIST'
  | 'MULTI_PICKLIST'
  | 'USER';

export type FieldStatus = 'ACTIVE' | 'INACTIVE';

export interface CustomFieldOption {
  id: string;
  label: string;
  color: string | null;
  sortOrder: number;
  defaultOption: boolean;
  /** False once deactivated: hidden from new answers, still shown on old records. */
  active: boolean;
}

/** A custom field definition. `apiName` is the key of its answer in a record's custom values; it never changes. */
export interface CustomField {
  id: string;
  entityType: EntityType;
  apiName: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  mandatory: boolean;
  unique: boolean;
  sensitive: boolean;
  defaultValue: unknown;
  /** Per-type rules: min, max, decimals, maxLength, regex, maxSelections. */
  config: Record<string, unknown>;
  status: FieldStatus;
  sortOrder: number;
  options: CustomFieldOption[];
}

export interface CustomFieldInput {
  entityType: EntityType;
  label: string;
  description?: string | null;
  fieldType: FieldType;
  mandatory: boolean;
  unique: boolean;
  sensitive: boolean;
  defaultValue?: unknown;
  config?: Record<string, unknown>;
  options?: { label: string; color?: string | null; defaultOption: boolean }[];
}

/** The type, the key and "unique" cannot change after creation, so edits don't send them. */
export interface CustomFieldUpdate {
  label: string;
  description?: string | null;
  mandatory: boolean;
  sensitive: boolean;
  defaultValue?: unknown;
  config?: Record<string, unknown>;
}

/** The Work service: custom fields of the active portal (X-Portal-Id). Served under /api/work/custom-fields. */
@Injectable({ providedIn: 'root' })
export class CustomFieldApi {
  private readonly http = inject(HttpClient);

  /** The active fields of a module, in form order. */
  list(entityType: EntityType = 'PROJECT'): Observable<CustomField[]> {
    return this.http
      .get<AppResponse<CustomField[]>>('/api/work/custom-fields', { params: { entityType } })
      .pipe(unwrap());
  }

  /** Active and inactive fields (needs CUSTOM_FIELDS_MANAGE). */
  listAll(entityType: EntityType = 'PROJECT'): Observable<CustomField[]> {
    return this.http
      .get<AppResponse<CustomField[]>>('/api/work/custom-fields/all', { params: { entityType } })
      .pipe(unwrap());
  }

  create(input: CustomFieldInput): Observable<CustomField> {
    return this.http.post<AppResponse<CustomField>>('/api/work/custom-fields', input).pipe(unwrap());
  }

  update(id: string, input: CustomFieldUpdate): Observable<CustomField> {
    return this.http.patch<AppResponse<CustomField>>(`/api/work/custom-fields/${id}`, input).pipe(unwrap());
  }

  deactivate(id: string): Observable<CustomField> {
    return this.http.post<AppResponse<CustomField>>(`/api/work/custom-fields/${id}/deactivate`, null).pipe(unwrap());
  }

  activate(id: string): Observable<CustomField> {
    return this.http.post<AppResponse<CustomField>>(`/api/work/custom-fields/${id}/activate`, null).pipe(unwrap());
  }

  /** How many records have an answer: the impact of deleting. */
  usage(id: string): Observable<{ records: number }> {
    return this.http.get<AppResponse<{ records: number }>>(`/api/work/custom-fields/${id}/usage`).pipe(unwrap());
  }

  delete(id: string): Observable<void> {
    return this.http.delete<AppResponse<void>>(`/api/work/custom-fields/${id}`).pipe(unwrap());
  }

  reorder(entityType: EntityType, fieldIds: string[]): Observable<CustomField[]> {
    return this.http
      .put<AppResponse<CustomField[]>>('/api/work/custom-fields/reorder', { entityType, fieldIds })
      .pipe(unwrap());
  }

  addOption(fieldId: string, option: { label: string; color?: string | null; defaultOption: boolean }): Observable<CustomField> {
    return this.http
      .post<AppResponse<CustomField>>(`/api/work/custom-fields/${fieldId}/options`, option)
      .pipe(unwrap());
  }

  updateOption(
    fieldId: string,
    optionId: string,
    option: { label: string; color?: string | null; defaultOption: boolean; active: boolean },
  ): Observable<CustomField> {
    return this.http
      .patch<AppResponse<CustomField>>(`/api/work/custom-fields/${fieldId}/options/${optionId}`, option)
      .pipe(unwrap());
  }
}

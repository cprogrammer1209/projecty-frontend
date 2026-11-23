import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { CustomField, CustomFieldApi } from '../../../core/customfield/custom-field.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { settingsEntity } from '../settings-entity';
import { MAX_FIELDS, PICK_TYPES, typeLabel } from './field-types';

interface Confirm {
  kind: 'deactivate' | 'delete';
  field: CustomField;
  /** Projects with an answer (delete only; null when the count could not be loaded). */
  count: number | null;
  busy: boolean;
  error: string | null;
}

/** Settings → Projects → Fields: the list of custom fields. Everyone with CUSTOM_FIELDS_VIEW sees it; changes need CUSTOM_FIELDS_MANAGE. */
@Component({
  selector: 'py-fields-page',
  imports: [RouterLink, Icon, Dialog],
  templateUrl: './fields-page.html',
  styleUrl: './fields.scss',
})
export class FieldsPage implements OnInit {
  private readonly api = inject(CustomFieldApi);
  private readonly toast = inject(ToastService);
  protected readonly entity = settingsEntity(inject(ActivatedRoute));
  protected readonly active = inject(ActivePortalService);

  protected readonly canManage = this.active.can('CUSTOM_FIELDS_MANAGE');
  protected readonly max = MAX_FIELDS;
  protected readonly items = signal<CustomField[] | null>(null);
  protected readonly showInactive = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirm = signal<Confirm | null>(null);
  protected readonly typeLabel = typeLabel;

  protected readonly shown = computed(() => (this.items() ?? []).filter((f) => this.showInactive() || f.status === 'ACTIVE'));
  protected readonly total = computed(() => this.items()?.length ?? 0);

  ngOnInit(): void {
    this.load();
  }

  protected newLink(): string[] {
    return ['/p', this.active.portal()?.slug ?? '', 'settings', this.entity.path, 'fields', 'new'];
  }

  protected editLink(f: CustomField): string[] {
    return [...this.newLink().slice(0, -1), f.id, 'edit'];
  }

  protected choiceCount(f: CustomField): string | null {
    if (!PICK_TYPES.includes(f.fieldType)) return null;
    const n = f.options.filter((o) => o.active).length;
    return `${n} choice${n === 1 ? '' : 's'}`;
  }

  protected index(f: CustomField): number {
    return (this.items() ?? []).findIndex((x) => x.id === f.id);
  }

  protected move(f: CustomField, delta: number): void {
    const list = [...(this.items() ?? [])];
    const i = this.index(f);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.run(this.api.reorder(this.entity.type, list.map((x) => x.id)));
  }

  protected activate(f: CustomField): void {
    this.run(this.api.activate(f.id), `${f.label} is active again.`);
  }

  protected askDeactivate(f: CustomField): void {
    this.confirm.set({ kind: 'deactivate', field: f, count: null, busy: false, error: null });
  }

  protected askDelete(f: CustomField): void {
    this.error.set(null);
    this.api.usage(f.id).subscribe({
      next: (u) => this.confirm.set({ kind: 'delete', field: f, count: u.records, busy: false, error: null }),
      error: () => this.confirm.set({ kind: 'delete', field: f, count: null, busy: false, error: null }),
    });
  }

  protected cancel(): void {
    if (!this.confirm()?.busy) this.confirm.set(null);
  }

  protected confirmed(): void {
    const c = this.confirm();
    if (!c || c.busy) return;
    this.confirm.set({ ...c, busy: true, error: null });
    const call: Observable<unknown> = c.kind === 'delete' ? this.api.delete(c.field.id) : this.api.deactivate(c.field.id);
    call.subscribe({
      next: () => {
        this.confirm.set(null);
        this.toast.show(c.kind === 'delete' ? `${c.field.label} deleted.` : `${c.field.label} deactivated.`);
        this.load();
      },
      error: (err: ApiError) => this.confirm.set({ ...c, busy: false, error: err.message }),
    });
  }

  private run(call: Observable<unknown>, notice?: string): void {
    this.error.set(null);
    this.busy.set(true);
    call.subscribe({
      next: () => {
        if (notice) this.toast.show(notice);
        this.load();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }

  private load(): void {
    (this.canManage ? this.api.listAll(this.entity.type) : this.api.list(this.entity.type)).subscribe({
      next: (list) => {
        this.items.set(list);
        this.busy.set(false);
      },
      error: (err: ApiError) => {
        this.items.update((x) => x ?? []);
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }
}

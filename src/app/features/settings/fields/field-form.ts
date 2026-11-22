import { Component, ElementRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, concat, last, map, of, startWith } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CustomField,
  CustomFieldApi,
  CustomFieldInput,
  CustomFieldOption,
  CustomFieldUpdate,
  FieldType,
} from '../../../core/customfield/custom-field.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ToastService } from '../../../core/ui/toast.service';
import { CustomValue } from '../../../shared/ui/custom-value/custom-value';
import { ValueField } from '../../../shared/ui/custom-value/custom-value.util';
import { Field } from '../../../shared/ui/field/field';
import { controlError, focusFirstInvalid, setServerError } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { FIELD_TYPES, NUMERIC_TYPES, PICK_TYPES, UNIQUE_TYPES } from './field-types';

/** One choice row in the editor. `id` is set once the server knows the choice. */
interface OptionRow {
  key: string;
  id: string | null;
  label: string;
  active: boolean;
  defaultOption: boolean;
  /** What the server holds now (saved choices only), to send only real changes. */
  original: { label: string; active: boolean; defaultOption: boolean } | null;
}

type ServerErrors = Partial<Record<'type' | 'config' | 'options' | 'unique' | 'defaultValue' | 'description', string>>;

const MAX_LABEL = 100;
const MAX_CHOICE = 60;
const CONFIG_KEYS = ['maxLength', 'min', 'max', 'decimals', 'maxSelections', 'regex'] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

/**
 * Create (`fields/new`) and edit (`fields/:id/edit`) a custom field. The type, the key and "unique" are fixed after
 * creation. Choices are never deleted: saved ones are deactivated.
 */
@Component({
  selector: 'py-field-form',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, CustomValue],
  templateUrl: './field-form.html',
  styleUrl: './fields.scss',
})
export class FieldForm implements OnInit {
  /** The field id from the route; absent when creating. */
  readonly id = input<string>();

  private readonly api = inject(CustomFieldApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);

  protected readonly types = FIELD_TYPES;
  protected readonly maxLabel = MAX_LABEL;
  protected readonly maxChoice = MAX_CHOICE;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(MAX_LABEL)]],
    fieldType: ['TEXT' as FieldType],
    description: [''],
    mandatory: [false],
    unique: [false],
    sensitive: [false],
    maxLength: [''],
    min: [''],
    max: [''],
    decimals: [''],
    maxSelections: [''],
    regex: [''],
  });

  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly alert = signal<string | null>(null);
  protected readonly serverErrors = signal<ServerErrors>({});
  protected readonly loading = signal(false);
  protected readonly missing = signal(false);
  /** The field being edited; null when creating. */
  protected readonly field = signal<CustomField | null>(null);
  protected readonly options = signal<OptionRow[]>([]);
  protected readonly defaultValue = signal<unknown>(null);
  /** What the preview holds while the author tries it out (pick one, pick several, person). */
  protected readonly previewValue = signal<unknown>(null);
  private nextKey = 1;

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    requireSync: true,
  });

  protected readonly type = computed(() => this.value().fieldType);
  protected readonly isPick = computed(() => PICK_TYPES.includes(this.type()));
  protected readonly canUnique = computed(() => UNIQUE_TYPES.includes(this.type()));
  protected readonly isNumeric = computed(() => NUMERIC_TYPES.includes(this.type()));
  protected readonly hasDefaultControl = computed(() => !this.value().unique && !this.isPick() && this.type() !== 'USER');
  protected readonly people = computed(() => {
    const me = this.auth.me();
    return me ? [{ userId: me.id, fullName: me.fullName }] : [];
  });
  protected readonly keyHint = computed(
    () =>
      'cf_' +
      (this.value()
        .label.toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'field'),
  );

  /** The field as the project form will show it. */
  protected readonly draft = computed<ValueField>(() => {
    const v = this.value();
    return {
      apiName: 'cf_preview',
      label: v.label.trim() || 'Untitled field',
      description: v.description.trim() || null,
      fieldType: v.fieldType,
      mandatory: v.mandatory,
      config: this.buildConfig(v.fieldType, v),
      options: this.options()
        .filter((o) => o.label.trim())
        .map((o, i): CustomFieldOption => ({ id: o.key, label: o.label.trim(), color: null, sortOrder: i, defaultOption: o.defaultOption, active: o.active })),
    };
  });
  /** The default control: no "Required" tag and no description, like the prototype. */
  protected readonly defaultDraft = computed<ValueField>(() => ({
    ...this.draft(),
    label: 'Default value',
    description: 'Filled in when a project is created. Optional.',
    mandatory: false,
    apiName: 'cf_default',
  }));

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.loadField(id);
    } else {
      this.options.set([this.newRow()]);
    }
  }

  protected backLink(): string[] {
    return ['/p', this.active.portal()?.slug ?? '', 'settings', 'projects', 'fields'];
  }

  protected labelError(): string | null {
    return controlError(this.form.controls.label, this.submitted(), {
      required: 'Name the field.',
      maxlength: `Use ${MAX_LABEL} characters or fewer.`,
    });
  }

  protected optionsError(): string | null {
    if (this.serverErrors().options) return this.serverErrors().options!;
    return this.submitted() && this.isPick() && !this.hasActiveChoice() ? 'Add at least one active choice.' : null;
  }

  protected onTypeChange(): void {
    const { fieldType, unique } = this.form.getRawValue();
    this.defaultValue.set(null);
    this.previewValue.set(null);
    for (const key of CONFIG_KEYS) this.form.controls[key].setValue('');
    if (!UNIQUE_TYPES.includes(fieldType) && unique) this.form.controls.unique.setValue(false);
    if (PICK_TYPES.includes(fieldType)) {
      if (!this.options().length) this.options.set([this.newRow()]);
    } else {
      this.options.set([]);
    }
    this.serverErrors.set({});
  }

  protected onUniqueChange(): void {
    if (this.form.controls.unique.value) this.defaultValue.set(null);
  }

  protected clearServer(key: keyof ServerErrors): void {
    if (this.serverErrors()[key]) this.serverErrors.update((e) => ({ ...e, [key]: undefined }));
  }

  // ---- choices ----

  protected setLabel(row: OptionRow, label: string): void {
    this.patchRow(row.key, { label });
    this.clearServer('options');
  }

  protected addChoice(): void {
    const row = this.newRow();
    this.options.update((list) => [...list, row]);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-choice="${row.key}"]`)?.focus());
  }

  protected removeChoice(row: OptionRow): void {
    this.options.update((list) => list.filter((o) => o.key !== row.key));
  }

  protected toggleActive(row: OptionRow): void {
    this.patchRow(row.key, { active: !row.active, defaultOption: row.active ? false : row.defaultOption });
  }

  protected toggleDefault(row: OptionRow, on: boolean): void {
    const single = this.type() === 'PICKLIST';
    this.options.update((list) => list.map((o) => (o.key === row.key ? { ...o, defaultOption: on } : single && on ? { ...o, defaultOption: false } : o)));
  }

  protected canMove(i: number, delta: number): boolean {
    const list = this.options();
    const j = i + delta;
    if (j < 0 || j >= list.length) return false;
    // Saved choices keep their order: the server has no call to reorder them.
    return !list[i].id && !list[j].id;
  }

  protected move(i: number, delta: number): void {
    if (!this.canMove(i, delta)) return;
    this.options.update((list) => {
      const next = [...list];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  }

  // ---- save ----

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    this.serverErrors.set({});
    this.form.markAllAsTouched();
    if (this.form.invalid || (this.isPick() && !this.hasActiveChoice())) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const f = this.field();
    this.busy.set(true);
    const label = this.form.controls.label.value.trim();
    const save$ = f ? this.saveEdit(f) : this.api.create(this.createInput()).pipe(map(() => undefined));
    save$.subscribe({
      next: () => {
        this.toast.show(f ? `${label} updated.` : `${label} added. It now shows in the default layout.`);
        this.router.navigate(this.backLink());
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.showError(err);
        if (f) this.resync(f.id);
        focusFirstInvalid(this.host.nativeElement);
      },
    });
  }

  private saveEdit(f: CustomField): Observable<void> {
    const v = this.form.getRawValue();
    const update: CustomFieldUpdate = {
      label: v.label.trim(),
      description: v.description.trim() || null,
      mandatory: v.mandatory,
      sensitive: v.sensitive,
      defaultValue: this.hasDefaultControl() ? this.defaultValue() : null,
      config: this.buildConfig(f.fieldType, v),
    };
    const rows = this.options().filter((o) => o.label.trim());
    const changed = rows.filter((o) => o.id && o.original && (o.label.trim() !== o.original.label || o.active !== o.original.active || o.defaultOption !== o.original.defaultOption));
    // Switch defaults off first so a pick-one field never has two defaults on the way.
    changed.sort((a, b) => Number(a.defaultOption) - Number(b.defaultOption));
    const calls: Observable<unknown>[] = [
      ...changed.map((o) => this.api.updateOption(f.id, o.id!, { label: o.label.trim(), defaultOption: o.defaultOption, active: o.active })),
      ...rows.filter((o) => !o.id).map((o) => this.api.addOption(f.id, { label: o.label.trim(), defaultOption: o.defaultOption })),
    ];
    // One after another; the first failure stops the rest.
    return concat(this.api.update(f.id, update), ...calls).pipe(last(), map(() => undefined));
  }

  private createInput(): CustomFieldInput {
    const v = this.form.getRawValue();
    return {
      entityType: 'PROJECT',
      label: v.label.trim(),
      description: v.description.trim() || null,
      fieldType: v.fieldType,
      mandatory: v.mandatory,
      unique: v.unique && UNIQUE_TYPES.includes(v.fieldType),
      sensitive: v.sensitive,
      defaultValue: this.hasDefaultControl() ? this.defaultValue() : null,
      config: this.buildConfig(v.fieldType, v),
      options: this.isPick() ? this.options().filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), defaultOption: o.active && o.defaultOption })) : undefined,
    };
  }

  /** Only the rules that apply to the type, and only the ones that are filled in. Numbers go as numbers when they parse. */
  private buildConfig(type: FieldType, v: Record<ConfigKey, string | number | null>): Record<string, unknown> {
    const keys: ConfigKey[] =
      type === 'TEXT' ? ['maxLength', 'regex'] : type === 'LONG_TEXT' ? ['maxLength'] : type === 'NUMBER' ? ['min', 'max'] : type === 'DECIMAL' ? ['min', 'max', 'decimals'] : type === 'MULTI_PICKLIST' ? ['maxSelections'] : [];
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = String(v[key] ?? '').trim();
      if (raw === '') continue;
      if (key === 'regex') {
        out[key] = raw;
      } else {
        const n = Number(raw);
        out[key] = Number.isFinite(n) ? n : raw;
      }
    }
    return out;
  }

  private showError(err: ApiError): void {
    if (err.code === 'VALIDATION_FAILED') {
      const rest: string[] = [];
      const server: ServerErrors = {};
      for (const [key, message] of Object.entries(err.details ?? {})) {
        if (typeof message !== 'string') continue;
        if (key === 'label') {
          setServerError(this.form.controls.label, message);
        } else if (key.startsWith('config')) {
          server.config = server.config ? `${server.config} ${message}` : message;
        } else if (key.startsWith('options')) {
          server.options = message;
        } else if (['type', 'fieldType'].includes(key)) {
          server.type = message;
        } else if (['unique', 'defaultValue', 'description'].includes(key)) {
          server[key as 'unique' | 'defaultValue' | 'description'] = message;
        } else {
          rest.push(message);
        }
      }
      this.serverErrors.set(server);
      if (rest.length || (!Object.keys(server).length && !this.form.controls.label.errors)) {
        this.alert.set(rest.join(' ') || err.message);
      }
      return;
    }
    this.alert.set(err.message);
  }

  // ---- loading ----

  private loadField(id: string): void {
    this.loading.set(true);
    this.api.listAll().subscribe({
      next: (list) => {
        this.loading.set(false);
        const f = list.find((x) => x.id === id);
        if (!f) {
          this.missing.set(true);
          return;
        }
        this.field.set(f);
        const c = f.config;
        const text = (k: string) => (c[k] === undefined || c[k] === null ? '' : String(c[k]));
        this.form.patchValue({
          label: f.label,
          fieldType: f.fieldType,
          description: f.description ?? '',
          mandatory: f.mandatory,
          unique: f.unique,
          sensitive: f.sensitive,
          maxLength: text('maxLength'),
          min: text('min'),
          max: text('max'),
          decimals: text('decimals'),
          maxSelections: text('maxSelections'),
          regex: text('regex'),
        });
        this.form.controls.fieldType.disable();
        this.form.controls.unique.disable();
        this.defaultValue.set(f.defaultValue ?? null);
        this.options.set(this.rowsOf(f));
        this.form.markAsPristine();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.alert.set(err.message);
      },
    });
  }

  /** After a failed save, show the choices as the server holds them now (some changes may have gone through). */
  private resync(id: string): void {
    this.api.listAll().subscribe({
      next: (list) => {
        const f = list.find((x) => x.id === id);
        if (f) {
          this.field.set(f);
          const typed = this.options().filter((o) => !o.id);
          const kept = typed.filter((o) => !f.options.some((s) => s.label === o.label.trim()));
          this.options.set([...this.rowsOf(f), ...kept]);
        }
      },
    });
  }

  private rowsOf(f: CustomField): OptionRow[] {
    return [...f.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => ({
        key: o.id,
        id: o.id,
        label: o.label,
        active: o.active,
        defaultOption: o.defaultOption,
        original: { label: o.label, active: o.active, defaultOption: o.defaultOption },
      }));
  }

  private newRow(): OptionRow {
    return { key: `new-${this.nextKey++}`, id: null, label: '', active: true, defaultOption: false, original: null };
  }

  private patchRow(key: string, patch: Partial<OptionRow>): void {
    this.options.update((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  private hasActiveChoice(): boolean {
    return this.options().some((o) => o.label.trim() && o.active);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { CustomField, CustomFieldApi, FieldType } from '../../../core/customfield/custom-field.api';
import { LayoutApi, LayoutEditor, LayoutPlacement } from '../../../core/customfield/layout.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { SaveBarService } from '../../../core/ui/save-bar.service';
import { ToastService } from '../../../core/ui/toast.service';
import { HasUnsavedChanges } from '../../../core/ui/unsaved-changes.guard';
import { applyServerErrors } from '../../../shared/ui/form-errors';
import { CustomValue } from '../../../shared/ui/custom-value/custom-value';
import { ValueField, parseNumber } from '../../../shared/ui/custom-value/custom-value.util';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Popover } from '../../../shared/ui/popover/popover';
import { MOD, isTyping } from './layout-builder-keys';
import {
  Draft,
  FIELD_TYPES,
  PICK_TYPES,
  TYPE_LABEL,
  UNPLACED,
  defaultLabel,
  effective,
  find,
  fromEditor,
  isWide,
  move,
  newPlacement,
  plural,
  problem,
  shift,
  toUpdate,
  unplaced,
} from './layout-draft';

type SideTab = 'fields' | 'types' | 'field';
type Device = 'desktop' | 'tablet' | 'phone';

const DEVICES: { id: Device; label: string; width: number }[] = [
  { id: 'desktop', label: 'Desktop', width: 1040 },
  { id: 'tablet', label: 'Tablet', width: 640 },
  { id: 'phone', label: 'Phone', width: 360 },
];

/** Where a drop would land: the section (or the field list), and the field it goes before (null = the end). */
interface DropTarget {
  zone: string;
  before: string | null;
  mark: string | null;
  over: boolean;
}

interface NewFieldRequest {
  type: FieldType | null;
  to: string | null;
  before: string | null;
}

/**
 * Settings → Projects → Layouts → one layout (CUS-US-22, 25): the visual builder. A draft of sections and field
 * cards is edited with the mouse (drag and drop) or the keyboard; nothing is stored until Save changes.
 */
@Component({
  selector: 'py-layout-builder',
  imports: [ReactiveFormsModule, RouterLink, Dialog, Popover, Icon, CustomValue],
  templateUrl: './layout-builder.html',
  styleUrl: './layout-builder.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class LayoutBuilder implements OnInit, HasUnsavedChanges {
  readonly id = input.required<string>();

  private readonly layoutApi = inject(LayoutApi);
  private readonly fieldApi = inject(CustomFieldApi);
  private readonly toast = inject(ToastService);
  private readonly saveBar = inject(SaveBarService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly injector = inject(Injector);
  protected readonly active = inject(ActivePortalService);

  protected readonly canManage = this.active.can('CUSTOM_FIELDS_MANAGE');
  protected readonly typeLabel = TYPE_LABEL;
  protected readonly fieldTypes = FIELD_TYPES;
  protected readonly devices = DEVICES;
  protected readonly mod = MOD;
  protected readonly plural = plural;
  protected readonly defaultLabel = defaultLabel;
  protected readonly effective = effective;
  protected readonly isWideOf = isWide;
  protected hasDefault(p: LayoutPlacement): boolean {
    return p.defaultValue !== null && p.defaultValue !== undefined && p.defaultValue !== '';
  }

  /* ---- state ---- */
  protected readonly status = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  protected readonly loadError = signal('');
  protected readonly draft = signal<Draft | null>(null);
  private readonly saved = signal('');
  protected readonly fields = signal<CustomField[]>([]);
  protected readonly sel = signal<string | null>(null);
  protected readonly tab = signal<SideTab>('fields');
  protected readonly query = signal('');
  protected readonly view = signal<'edit' | 'preview'>('edit');
  protected readonly device = signal<Device>('desktop');
  protected readonly saving = signal(false);

  /* drag and drop */
  protected readonly dragKey = signal<string | null>(null);
  protected readonly overZone = signal<string | null>(null);
  protected readonly mark = signal<string | null>(null);

  /* move popover */
  protected readonly moveFor = signal<{ key: string; anchor: HTMLElement } | null>(null);
  protected readonly moveQuery = signal('');
  protected readonly moveAct = signal(0);

  /* new field dialog */
  protected readonly fieldDialog = signal<NewFieldRequest | null>(null);
  protected readonly fieldBusy = signal(false);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly fieldForm = this.fb.group({ label: '', type: 'TEXT' as FieldType, opts: '', req: false });
  protected readonly fieldType = signal<FieldType>('TEXT');

  /* ---- derived ---- */
  protected readonly fieldMap = computed(() => new Map(this.fields().map((f) => [f.apiName, f])));
  protected readonly dirty = computed(() => {
    const d = this.draft();
    return d !== null && JSON.stringify(d) !== this.saved();
  });
  protected readonly problem = computed(() => {
    const d = this.draft();
    return d ? problem(d) : null;
  });
  protected readonly free = computed(() => {
    const d = this.draft();
    return d ? unplaced(d, this.fields()) : [];
  });
  protected readonly palette = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.free().filter((f) => f.label.toLowerCase().includes(q));
  });
  /** Field keys in canvas order, for the arrow keys. */
  private readonly cardKeys = computed(() => (this.draft()?.sections ?? []).flatMap((s) => s.fields.map((p) => p.apiName)));
  protected readonly selected = computed(() => {
    const key = this.sel();
    const d = this.draft();
    const field = key ? this.fieldMap().get(key) : undefined;
    const at = key && d ? find(d, key) : null;
    return field && at && d ? { field, at, wide: isWide(d, field) } : null;
  });
  protected readonly moveOptions = computed(() => {
    const d = this.draft();
    const f = this.moveFor();
    if (!d || !f) return [];
    const cur = find(d, f.key)?.section.id ?? UNPLACED;
    const q = this.moveQuery().trim().toLowerCase();
    return [
      ...d.sections.map((s) => ({ id: s.id, label: s.name || 'Untitled section', icon: 'layouts' })),
      { id: UNPLACED, label: 'Not on this layout', icon: 'eye' },
    ]
      .filter((o) => o.label.toLowerCase().includes(q))
      .map((o) => ({ ...o, current: o.id === cur }));
  });
  protected readonly previewSections = computed(() => {
    const d = this.draft();
    if (!d) return [];
    return d.sections.map((s) => ({
      name: s.name || 'Untitled section',
      items: s.fields.flatMap((p) => {
        const f = this.fieldMap().get(p.apiName);
        if (!f || f.status !== 'ACTIVE') return [];
        const e = effective(d, f);
        const field: ValueField = { ...f, mandatory: e.mandatory, readOnly: e.readOnly, wide: isWide(d, f) };
        return [{ key: p.apiName, wide: field.wide === true, field, value: e.defaultValue ?? null }];
      }),
    }));
  });
  protected readonly deviceWidth = computed(() => DEVICES.find((x) => x.id === this.device())?.width ?? 1040);

  constructor() {
    effect(() => {
      const dirty = this.dirty();
      const bad = this.problem() !== null;
      untracked(() => {
        if (dirty) this.saveBar.show({ save: () => this.save(), discard: () => this.discard() }, bad);
        else this.saveBar.hide();
      });
    });
    inject(DestroyRef).onDestroy(() => this.saveBar.hide());
    this.fieldForm.controls.type.valueChanges.subscribe((t) => this.fieldType.set(t));
  }

  ngOnInit(): void {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /* ---- loading, saving ---- */
  private load(): void {
    this.layoutApi.editor(this.id()).subscribe({
      next: (e) => {
        this.adopt(e);
        this.status.set('ready');
      },
      error: (err: ApiError) => {
        this.loadError.set(err.message);
        this.status.set(err.status === 404 || err.status === 400 ? 'missing' : 'error');
      },
    });
  }

  /** Replaces the draft (and what counts as saved) with the stored layout. */
  private adopt(e: LayoutEditor): void {
    const d = fromEditor(e);
    this.draft.set(d);
    this.saved.set(JSON.stringify(d));
    this.fields.set(e.fields);
  }

  protected save(): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    const pr = problem(d);
    if (pr) {
      this.toast.show(pr, 'err');
      return;
    }
    this.saving.set(true);
    this.saveBar.saving.set(true);
    this.layoutApi.update(d.id, toUpdate(d)).subscribe({
      next: (e) => {
        this.saving.set(false);
        this.saveBar.saving.set(false);
        this.adopt(e);
        this.toast.show('Layout saved');
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.saveBar.saving.set(false);
        this.toast.show(err.message, 'err');
      },
    });
  }

  protected discard(): void {
    this.layoutApi.editor(this.id()).subscribe({
      next: (e) => {
        this.adopt(e);
        this.sel.set(null);
        this.tab.set('fields');
        this.toast.show('Changes discarded');
      },
      error: (err: ApiError) => this.toast.show(err.message, 'err'),
    });
  }

  /* ---- editing the draft ---- */
  /** Runs an edit on a copy of the draft, then publishes it. */
  private edit(fn: (d: Draft) => void): void {
    const d = this.draft();
    if (!d) return;
    const copy = structuredClone(d);
    fn(copy);
    this.draft.set(copy);
  }

  private placement(fn: (p: LayoutPlacement) => void): void {
    const key = this.sel();
    if (!key) return;
    this.edit((d) => {
      const at = find(d, key);
      if (at) fn(at.placement);
    });
  }

  protected setTitle(value: string): void {
    this.edit((d) => (d.name = value));
  }

  protected setSectionName(id: string, value: string): void {
    this.edit((d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.name = value;
    });
  }

  protected setCollapsible(id: string, value: boolean): void {
    this.edit((d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.collapsible = value;
    });
  }

  protected moveSection(id: string, delta: number): void {
    this.edit((d) => {
      const i = d.sections.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i >= 0 && j >= 0 && j < d.sections.length) [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
    });
    const attr = delta < 0 ? 'sec-up' : 'sec-down';
    afterNextRender(() => {
      const b = document.querySelector<HTMLButtonElement>(`[data-sec="${id}"] [data-act="${attr}"]`);
      if (b && !b.disabled) b.focus();
    }, { injector: this.injector });
  }

  protected deleteSection(id: string): void {
    const d = this.draft();
    if (!d) return;
    if (d.sections.length === 1) {
      this.toast.show('A layout needs at least one section.', 'err');
      return;
    }
    const n = d.sections.find((s) => s.id === id)?.fields.length ?? 0;
    this.edit((x) => (x.sections = x.sections.filter((s) => s.id !== id)));
    if (n) this.toast.show(`${plural(n, 'field')} removed from the layout`);
  }

  protected addSection(): void {
    const id = 's' + Math.random().toString(36).slice(2, 9);
    this.edit((d) => d.sections.push({ id, name: '', collapsible: true, fields: [] }));
    afterNextRender(() => {
      const n = document.querySelector<HTMLElement>(`[data-sec="${id}"] .sec-name`);
      n?.focus();
      n?.scrollIntoView({ block: 'center' });
    }, { injector: this.injector });
  }

  protected toggleWidth(key: string): void {
    const d = this.draft();
    const f = this.fieldMap().get(key);
    if (!d || !f || !find(d, key)) return;
    const wide = !isWide(d, f);
    this.edit((x) => {
      const at = find(x, key);
      if (at) at.placement.wide = wide;
    });
  }

  protected hide(key: string): void {
    const d = this.draft();
    if (!d || !find(d, key)) return;
    this.edit((x) => move(x, key, UNPLACED));
    if (this.sel() === key) this.tab.set('fields');
    this.toast.show('Removed from the layout. Its answers are kept.');
  }

  protected addToLast(key: string): void {
    const d = this.draft();
    if (!d) return;
    const last = d.sections[d.sections.length - 1];
    this.edit((x) => move(x, key, last.id));
    this.sel.set(key);
    this.toast.show(`Added to ${last.name || 'the last section'}`);
  }

  /* inspector */
  protected setRequired(value: string): void {
    this.placement((p) => (p.mandatory = value === '' ? null : value === 'true'));
  }

  protected setWidth(full: boolean): void {
    this.placement((p) => (p.wide = full));
  }

  protected setReadOnly(value: boolean): void {
    this.placement((p) => (p.readOnly = value));
  }

  protected setDefault(field: CustomField, value: unknown): void {
    let v: unknown = value;
    if (field.fieldType === 'CHECKBOX') v = value === true ? true : null;
    else if (field.fieldType === 'NUMBER' || field.fieldType === 'DECIMAL') v = parseNumber(String(value));
    else if (value === '') v = null;
    this.placement((p) => (p.defaultValue = v));
  }

  protected moveToSection(sectionId: string): void {
    const key = this.sel();
    if (!key) return;
    this.edit((d) => move(d, key, sectionId));
    this.focusSel();
  }

  /* ---- selection and focus ---- */
  protected select(key: string, focus = true): void {
    this.sel.set(key);
    if (focus) this.focusSel();
  }

  protected openSettings(key: string): void {
    this.sel.set(key);
    this.tab.set('field');
  }

  protected onDblClick(event: MouseEvent, key: string): void {
    if ((event.target as HTMLElement).closest('button, input')) return;
    this.openSettings(key);
  }

  private focusSel(): void {
    afterNextRender(() => {
      const r = this.cardEl(this.sel());
      if (r) {
        r.focus({ preventScroll: true });
        r.scrollIntoView({ block: 'nearest' });
      }
    }, { injector: this.injector });
  }

  private cardEl(key: string | null): HTMLElement | null {
    return key ? (Array.from(document.querySelectorAll<HTMLElement>('.cv-canvas .fcard')).find((c) => c.dataset['key'] === key) ?? null) : null;
  }

  /* ---- move popover ---- */
  protected openMove(key: string): void {
    const anchor = this.cardEl(key) ?? (document.querySelector('.cv-canvas') as HTMLElement);
    this.moveQuery.set('');
    this.moveAct.set(0);
    this.moveFor.set({ key, anchor });
    setTimeout(() => document.querySelector<HTMLElement>('.mv input')?.focus());
  }

  protected closeMove(): void {
    if (!this.moveFor()) return;
    this.moveFor.set(null);
    this.focusSel();
  }

  protected moveInput(value: string): void {
    this.moveQuery.set(value);
    this.moveAct.set(0);
  }

  protected moveKeys(event: KeyboardEvent): void {
    const n = this.moveOptions().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (n) this.moveAct.update((i) => (event.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const o = this.moveOptions()[this.moveAct()];
      if (o) this.pickMove(o.id);
    }
  }

  protected pickMove(to: string): void {
    const f = this.moveFor();
    const d = this.draft();
    if (!f || !d) return;
    this.moveFor.set(null);
    const cur = find(d, f.key)?.section.id ?? UNPLACED;
    if (cur !== to) {
      this.edit((x) => move(x, f.key, to));
      this.sel.set(f.key);
      if (to === UNPLACED) this.tab.set('fields');
      this.toast.show(`Moved to ${to === UNPLACED ? 'the field list' : (d.sections.find((s) => s.id === to)?.name ?? 'the section')}`);
    }
    this.focusSel();
  }

  /* ---- new field ---- */
  protected openFieldDialog(request: Partial<NewFieldRequest> = {}): void {
    this.fieldError.set(null);
    this.fieldForm.reset({ label: '', type: request.type ?? 'TEXT', opts: '', req: false });
    this.fieldType.set(request.type ?? 'TEXT');
    this.fieldDialog.set({ type: request.type ?? null, to: request.to ?? null, before: request.before ?? null });
  }

  protected closeFieldDialog(): void {
    if (!this.fieldBusy()) this.fieldDialog.set(null);
  }

  protected isPick(type: FieldType): boolean {
    return PICK_TYPES.includes(type);
  }

  protected createField(): void {
    const request = this.fieldDialog();
    if (!request) return;
    const v = this.fieldForm.getRawValue();
    const options = this.isPick(v.type)
      ? v.opts.split('\n').map((x) => x.trim()).filter(Boolean).map((label) => ({ label, defaultOption: false }))
      : [];
    this.fieldBusy.set(true);
    this.fieldError.set(null);
    this.fieldApi
      .create({
        entityType: 'PROJECT',
        label: v.label.trim(),
        description: null,
        fieldType: v.type,
        mandatory: v.req,
        unique: false,
        sensitive: false,
        defaultValue: null,
        config: {},
        options,
      })
      .subscribe({
        next: (created) => this.afterCreate(created, request),
        error: (err: ApiError) => {
          this.fieldBusy.set(false);
          applyServerErrors(this.fieldForm, err.details ?? {}, { fieldType: 'type' });
          this.fieldError.set(err.message);
        },
      });
  }

  private afterCreate(created: CustomField, request: NewFieldRequest): void {
    this.layoutApi.editor(this.id()).subscribe({
      next: (e) => this.placeCreated(created, request, e.fields),
      error: () => this.placeCreated(created, request, [...this.fields(), created]),
    });
  }

  private placeCreated(created: CustomField, request: NewFieldRequest, fields: CustomField[]): void {
    this.fieldBusy.set(false);
    this.fieldDialog.set(null);
    this.fields.set(fields);
    const key = created.apiName;
    const d = this.draft();
    if (d?.defaultLayout && !find(d, key)) {
      // The server already put a new field in the default layout's last section: mirror it in the draft and the saved copy.
      const last = d.sections.length - 1;
      this.edit((x) => x.sections[last].fields.push(newPlacement(key)));
      const copy = JSON.parse(this.saved()) as Draft;
      copy.sections[last]?.fields.push(newPlacement(key));
      this.saved.set(JSON.stringify(copy));
    }
    if (request.to) this.edit((x) => move(x, key, request.to as string, request.before));
    this.sel.set(key);
    const placed = !!find(this.draft() as Draft, key);
    if (!placed) this.tab.set('fields');
    else if (request.to) this.focusSel();
    this.toast.show(placed ? 'Field created and added to this layout.' : 'Field created. Drag it onto the canvas.');
  }

  /* ---- drag and drop ---- */
  private dropTarget(e: DragEvent): DropTarget | null {
    const el = e.target as HTMLElement | null;
    const z = el?.closest<HTMLElement>('[data-drop]');
    if (!z) return null;
    const c = el?.closest<HTMLElement>('.fcard') ?? null;
    const drag = this.dragKey();
    const zone = z.dataset['drop'] as string;
    let before: string | null = null;
    let mark: string | null = null;
    if (c && c.dataset['key'] !== drag && zone !== UNPLACED) {
      const b = c.getBoundingClientRect();
      const after = c.classList.contains('wide') ? e.clientY > b.top + b.height / 2 : e.clientX > b.left + b.width / 2;
      const cards = Array.from(z.querySelectorAll<HTMLElement>('.fcard')).filter((x) => x.dataset['key'] !== drag);
      const i = cards.indexOf(c);
      before = after ? (cards[i + 1]?.dataset['key'] ?? null) : (c.dataset['key'] as string);
      mark = `${c.dataset['key']}:${after ? 'after' : 'before'}`;
    }
    return { zone, before, mark, over: !!c && c.dataset['key'] === drag };
  }

  protected dragStart(event: DragEvent, key: string): void {
    this.dragKey.set(key);
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOver(event: DragEvent): void {
    if (!this.dragKey()) return;
    const t = this.dropTarget(event);
    if (!t) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.overZone.set(t.zone);
    this.mark.set(t.mark);
  }

  protected drop(event: DragEvent): void {
    const key = this.dragKey();
    if (!key) return;
    const t = this.dropTarget(event);
    if (!t) return;
    event.preventDefault();
    this.dragEnd();
    if (t.over) return;
    if (key.startsWith('__new:')) {
      if (t.zone !== UNPLACED) this.openFieldDialog({ type: key.slice(6) as FieldType, to: t.zone, before: t.before });
      return;
    }
    this.edit((d) => move(d, key, t.zone, t.before));
    this.sel.set(key);
    if (t.zone !== UNPLACED) this.focusSel();
  }

  protected dragEnd(): void {
    this.dragKey.set(null);
    this.overZone.set(null);
    this.mark.set(null);
  }

  /* ---- keyboard ---- */
  protected onKey(e: KeyboardEvent): void {
    if (this.status() !== 'ready') return;
    const k = e.key;
    if (k === 'Escape') {
      if (isTyping(e.target)) {
        (e.target as HTMLElement).blur();
        if (this.sel()) this.focusSel();
      }
      return;
    }
    if (isTyping(e.target) || this.view() !== 'edit') return;
    if (this.moveFor() || this.fieldDialog()) return;
    const mod = e.metaKey || e.ctrlKey;
    const sel = this.sel();
    const keys = this.cardKeys();
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      if (!keys.length) return;
      const dir = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1;
      if (mod) {
        const d = this.draft();
        if (sel && d && find(d, sel)) {
          this.edit((x) => shift(x, sel, dir));
          this.focusSel();
        }
        return;
      }
      const i = sel ? keys.indexOf(sel) : -1;
      this.select(keys[i < 0 ? (dir > 0 ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, i + dir))]);
      return;
    }
    if (!sel || mod || e.altKey) return;
    const onButton = !!(e.target as HTMLElement | null)?.closest?.('button');
    if (k === 'm' || k === 'M') {
      e.preventDefault();
      this.openMove(sel);
    } else if (k === 'w' || k === 'W') {
      e.preventDefault();
      this.toggleWidth(sel);
    } else if (k === 'o' || k === 'O' || k === 'Enter') {
      if (onButton && k === 'Enter') return;
      e.preventDefault();
      this.tab.set('field');
      afterNextRender(() => document.querySelector<HTMLElement>('[data-ins] input, [data-ins] select')?.focus(), { injector: this.injector });
    } else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      this.hide(sel);
    }
  }
}

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LayoutField } from '../../core/customfield/layout.api';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { PersonOption, displayValue, isEmptyValue, isWideField, parseNumber } from '../../shared/ui/custom-value/custom-value.util';
import { Popover } from '../../shared/ui/popover/popover';
import { initials } from '../auth/text';
import { Autofocus } from './autofocus';
import { Calendar } from './calendar';

/** Saves one answer. Rejects with an Error whose message is shown under the value. `optimistic` answers already show. */
export type SaveValue = (apiName: string, value: unknown, optimistic: boolean) => Promise<void | false>;

interface Choice {
  id: string;
  label: string;
  person: boolean;
}

const TEXTY = ['TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL'];
const FLASH_MS = 1600;

const blankToNull = (v: unknown): unknown => (isEmptyValue(v) ? null : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(blankToNull(a)) === JSON.stringify(blankToNull(b));

/**
 * The Linear-style property list of one section on the project overview (the rows go inside a `.cf-props` grid):
 * every value is a quiet button and nothing has Save or Cancel. People who can't edit, and read-only fields, see text.
 */
@Component({
  selector: 'py-property-list',
  imports: [Icon, Popover, Calendar, Autofocus, NgTemplateOutlet],
  templateUrl: './property-list.html',
  styleUrl: './property-list.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyList {
  readonly fields = input.required<LayoutField[]>();
  readonly values = input.required<Record<string, unknown>>();
  readonly people = input<PersonOption[]>([]);
  readonly canEdit = input(false);
  readonly save = input.required<SaveValue>();

  private readonly day = new PyDayPipe();
  protected readonly initials = initials;
  protected readonly isWide = isWideField;
  protected readonly isEmpty = isEmptyValue;

  /** The field whose popover is open, the one being typed into, the search text and the text being typed. */
  protected readonly pop = signal<string | null>(null);
  protected readonly editing = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly draft = signal('');
  protected readonly error = signal<{ k: string; msg: string } | null>(null);
  protected readonly flash = signal<string | null>(null);
  private saving = false;

  protected readonly formatDate = (iso: string): string => this.day.transform(iso);

  protected text(f: LayoutField): string {
    return displayValue(f, this.values()[f.apiName], this.people(), this.formatDate);
  }

  protected personName(f: LayoutField): string {
    return this.people().find((p) => p.userId === this.values()[f.apiName])?.fullName ?? '?';
  }

  protected chosen = (f: LayoutField): string[] => {
    const v = this.values()[f.apiName];
    return Array.isArray(v) ? (v as string[]) : [];
  };

  protected multiLabels(f: LayoutField): string[] {
    const options = f.options;
    return this.chosen(f).map((id) => options.find((o) => o.id === id)?.label ?? 'Unknown choice');
  }

  /** Active choices, plus a deactivated one this record already holds; filtered by the search box. */
  protected readonly choices = (f: LayoutField): Choice[] => {
    const q = this.query().trim().toLowerCase();
    const all: Choice[] =
      f.fieldType === 'USER'
        ? this.people().map((p) => ({ id: p.userId, label: p.fullName, person: true }))
        : (() => {
            const v = this.values()[f.apiName];
            const held = Array.isArray(v) ? (v as string[]) : [v];
            return f.options
              .filter((o) => o.active || held.includes(o.id))
              .map((o) => ({ id: o.id, label: o.label + (o.active ? '' : ' (inactive)'), person: false }));
          })();
    return all.filter((c) => c.label.toLowerCase().includes(q));
  };

  protected readonly canClear = (f: LayoutField): boolean =>
    f.fieldType !== 'MULTI_PICKLIST' && !f.mandatory && !isEmptyValue(this.values()[f.apiName]) && !this.query();

  protected readonly maxLength = (f: LayoutField): number | null => {
    const n = f.config['maxLength'];
    return typeof n === 'number' ? n : null;
  };

  protected toggleCheck(f: LayoutField): void {
    void this.commit(f, !this.values()[f.apiName], { optimistic: true });
  }

  protected openPop(f: LayoutField): void {
    if (this.pop() === f.apiName) {
      this.closePop();
      return;
    }
    this.pop.set(f.apiName);
    this.query.set('');
    this.editing.set(null);
    this.error.set(null);
  }

  protected closePop(k?: string): void {
    if (k === undefined || this.pop() === k) {
      this.pop.set(null);
      this.error.set(null);
    }
  }

  protected startEdit(f: LayoutField): void {
    const v = this.values()[f.apiName];
    this.pop.set(null);
    this.error.set(null);
    this.draft.set(isEmptyValue(v) ? '' : String(v));
    this.editing.set(f.apiName);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  protected pick(f: LayoutField, id: string): void {
    if (f.fieldType === 'MULTI_PICKLIST') {
      const next = new Set(this.chosen(f));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void this.commit(f, [...next], { keepOpen: true, optimistic: true });
      return;
    }
    void this.commit(f, id || null, { optimistic: true });
  }

  protected pickDate(f: LayoutField, iso: string | null): void {
    void this.commit(f, iso, { optimistic: true });
  }

  /** Enter saves (Ctrl or Cmd+Enter in long text, where Enter adds a line); Esc restores the old value. */
  protected onKey(event: KeyboardEvent, f: LayoutField): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    } else if (event.key === 'Enter' && (f.fieldType !== 'LONG_TEXT' || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.commitDraft(f);
    }
  }

  /** Leaving the input saves, unless focus only moved to another part of the same editor. */
  protected onBlur(f: LayoutField): void {
    setTimeout(() => {
      if (this.editing() === f.apiName && !this.saving) this.commitDraft(f);
    });
  }

  private commitDraft(f: LayoutField): void {
    const raw = this.draft();
    const numeric = f.fieldType === 'NUMBER' || f.fieldType === 'DECIMAL';
    const value = raw === '' ? null : numeric ? parseNumber(raw) : raw;
    void this.commit(f, value, {});
  }

  private async commit(
    f: LayoutField,
    value: unknown,
    { keepOpen = false, optimistic = false }: { keepOpen?: boolean; optimistic?: boolean },
  ): Promise<void> {
    const k = f.apiName;
    if (this.saving) return;
    if (same(this.values()[k], value)) {
      if (!keepOpen) this.pop.set(null);
      this.editing.set(null);
      return;
    }
    this.error.set(null);
    if (!keepOpen) this.pop.set(null);
    if (optimistic) this.editing.set(null);
    this.saving = true;
    try {
      const saved = await this.save()(k, value, optimistic);
      this.editing.set(null);
      if (saved === false) return; // the person took it back (a question was answered No)
      this.flash.set(k);
      setTimeout(() => {
        if (this.flash() === k) this.flash.set(null);
      }, FLASH_MS);
    } catch (err) {
      this.error.set({ k, msg: err instanceof Error ? err.message : 'Could not save.' });
      if (!TEXTY.includes(f.fieldType) && !keepOpen && f.fieldType !== 'CHECKBOX') this.pop.set(k);
    } finally {
      this.saving = false;
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { Field } from '../field/field';
import { PersonOption, ValueField, parseNumber } from './custom-value.util';

/**
 * The input for one custom field, by its type: text, long text, number, decimal, date, checkbox, pick one, pick several,
 * person. Two-way bind the value (`[(value)]`); it is null when empty. Used by the project form, the layout builder
 * preview and the layout's default-value control.
 */
@Component({
  selector: 'py-custom-value',
  imports: [Field],
  templateUrl: './custom-value.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomValue {
  readonly field = input.required<ValueField>();
  readonly value = model<unknown>(null);
  readonly error = input<string | null>(null);
  readonly people = input<PersonOption[]>([]);
  readonly disabled = input(false);
  /** Hide the label row (the caller shows it). */
  readonly bare = input(false);

  protected readonly id = computed(() => `cv-${this.field().apiName}`);
  protected readonly activeOptions = computed(() => {
    const held = this.chosen();
    return this.field().options.filter((o) => o.active || held.includes(o.id));
  });
  protected readonly hint = computed(() => this.error() === null ? this.field().description ?? this.rule() : null);

  private readonly rule = computed(() => {
    const c = this.field().config;
    const min = c['min'], max = c['max'], limit = c['maxSelections'];
    if (this.field().fieldType === 'MULTI_PICKLIST' && typeof limit === 'number') return `Pick at most ${limit}.`;
    if ((min !== undefined || max !== undefined) && ['NUMBER', 'DECIMAL'].includes(this.field().fieldType)) {
      return `${min !== undefined ? `From ${min}` : ''}${min !== undefined && max !== undefined ? ' ' : ''}${max !== undefined ? `up to ${max}` : ''}.`;
    }
    return null;
  });

  protected text(): string {
    const v = this.value();
    return v === null || v === undefined ? '' : String(v);
  }

  protected chosen(): string[] {
    const v = this.value();
    return Array.isArray(v) ? (v as string[]) : [];
  }

  protected setText(raw: string): void {
    this.value.set(raw === '' ? null : raw);
  }

  protected setNumber(raw: string): void {
    this.value.set(parseNumber(raw));
  }

  protected setPick(raw: string): void {
    this.value.set(raw === '' ? null : raw);
  }

  protected toggle(id: string, on: boolean): void {
    const next = new Set(this.chosen());
    if (on) next.add(id); else next.delete(id);
    this.value.set(next.size ? [...next] : null);
  }
}

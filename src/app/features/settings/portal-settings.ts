import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/api/api.types';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { DATE_FORMATS, PortalApi, WeekStart } from '../../core/portal/portal.api';
import { zoneOffset } from '../../shared/pipes/py-date.pipe';
import { Field } from '../../shared/ui/field/field';
import { applyServerErrors } from '../../shared/ui/form-errors';
import { Icon } from '../../shared/ui/icon/icon';

const SUPPORTED_ZONES: string[] = Intl.supportedValuesOf('timeZone');

/**
 * The browser's zone list, plus `current` if missing: browsers list some zones under older names
 * (Asia/Calcutta for Asia/Kolkata), and a saved value must still show as selected.
 */
export function timeZoneOptions(current: string | null | undefined): string[] {
  return current && !SUPPORTED_ZONES.includes(current) ? [current, ...SUPPORTED_ZONES] : SUPPORTED_ZONES;
}
const CURRENCY_NAMES = new Intl.DisplayNames(['en'], { type: 'currency' });
export const CURRENCIES = Intl.supportedValuesOf('currency').map((code) => ({
  code,
  label: `${code} — ${CURRENCY_NAMES.of(code) ?? code}`,
}));
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'SUNDAY', label: 'Sunday' },
  { value: 'SATURDAY', label: 'Saturday' },
];

/** PTL-US-02: the portal's time zone, date format, currency and week start. Owner only for now. */
@Component({
  selector: 'py-portal-settings',
  imports: [ReactiveFormsModule, Field, Icon],
  templateUrl: './portal-settings.html',
  styleUrl: './settings-card.scss',
})
export class PortalSettings {
  private readonly portalApi = inject(PortalApi);
  private readonly active = inject(ActivePortalService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly portal = this.active.portal;
  protected readonly canManage = this.active.can('PORTAL_SETTINGS_MANAGE');
  protected readonly timeZones = timeZoneOptions(this.portal()?.timeZone);
  protected readonly currencies = CURRENCIES;
  protected readonly dateFormats = DATE_FORMATS;
  protected readonly weekStarts = WEEK_STARTS;
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly now = new Date();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    timeZone: [this.portal()?.timeZone ?? 'UTC', Validators.required],
    dateFormat: [this.portal()?.dateFormat ?? DATE_FORMATS[0], Validators.required],
    currency: [this.portal()?.currency ?? 'USD', Validators.required],
    weekStart: [(this.portal()?.weekStart ?? 'MONDAY') as WeekStart, Validators.required],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** PTL-BR-04: changing the currency doesn't convert amounts already entered. */
  protected readonly currencyChanged = computed(() => this.value().currency !== this.portal()?.currency);
  protected readonly preview = computed(() => {
    const v = this.value();
    const zone = v.timeZone ?? 'UTC';
    return formatDate(this.now, `${v.dateFormat}, h:mm a`, this.locale, zoneOffset(this.now, zone));
  });

  constructor() {
    if (!this.canManage) {
      this.form.disable();
    }
    this.form.valueChanges.subscribe(() => this.saved.set(false));
  }

  protected formatSample(pattern: string): string {
    return formatDate(this.now, pattern, this.locale);
  }

  protected submit(): void {
    this.error.set(null);
    this.busy.set(true);
    this.portalApi.updateSettings(this.form.getRawValue()).subscribe({
      next: (portal) => {
        this.active.update(portal);
        this.busy.set(false);
        this.saved.set(true);
        this.form.markAsPristine();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        if (!(err.code === 'VALIDATION_FAILED' && applyServerErrors(this.form, err.details))) {
          this.error.set(err.message);
        }
      },
    });
  }
}

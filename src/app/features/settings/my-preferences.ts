import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { zoneOffset } from '../../shared/pipes/py-date.pipe';
import { Field } from '../../shared/ui/field/field';
import { Icon } from '../../shared/ui/icon/icon';
import { timeZoneOptions } from './portal-settings';

/** PTL-US-12: a personal time zone that overrides every portal's for display. */
@Component({
  selector: 'py-my-preferences',
  imports: [ReactiveFormsModule, Field, Icon],
  template: `
    <section class="card">
      <h2>My time zone</h2>
      <p>Applies in every portal you belong to. Leave it on the portal default to follow each portal's setting.</p>
      @if (error(); as message) {
        <div class="py-alert" role="alert"><py-icon name="alert" /><span>{{ message }}</span></div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="grid">
          <py-field class="full" label="Time zone" for="mp-tz">
            <select id="mp-tz" class="py-select" formControlName="timeZone">
              <option value="">Portal default ({{ active.portal()?.timeZone }})</option>
              @for (zone of timeZones; track zone) { <option [value]="zone">{{ zone }}</option> }
            </select>
          </py-field>
          <p class="preview full">Dates will show like: <strong>{{ preview() }}</strong></p>
        </div>
        <div class="foot">
          <button class="py-btn py-btn--primary" type="submit" [disabled]="busy() || form.pristine">
            @if (busy()) { <span class="py-spinner" aria-hidden="true"></span>Saving } @else { Save changes }
          </button>
          @if (saved()) { <span class="saved" role="status">Saved</span> }
        </div>
      </form>
    </section>
  `,
  styleUrl: './settings-card.scss',
})
export class MyPreferences {
  private readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly timeZones = timeZoneOptions(this.auth.me()?.timeZone);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly now = new Date();

  protected readonly form = inject(FormBuilder).nonNullable.group({ timeZone: this.auth.me()?.timeZone ?? '' });
  private readonly value = toSignal(this.form.controls.timeZone.valueChanges, {
    initialValue: this.form.controls.timeZone.value,
  });
  protected readonly preview = computed(() => {
    const zone = this.value() || this.active.portal()?.timeZone || 'UTC';
    const format = this.active.portal()?.dateFormat ?? 'MMM d, yyyy';
    return formatDate(this.now, `${format}, h:mm a`, this.locale, zoneOffset(this.now, zone)) + ` (${zone})`;
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.saved.set(false));
  }

  protected submit(): void {
    this.error.set(null);
    this.busy.set(true);
    this.auth.updatePreferences(this.form.controls.timeZone.value || null).subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.set(true);
        this.form.markAsPristine();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }
}

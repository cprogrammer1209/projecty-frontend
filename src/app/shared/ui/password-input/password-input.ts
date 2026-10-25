import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Icon } from '../icon/icon';

/** Password box with a show/hide toggle. Works with `formControlName`. */
@Component({
  selector: 'py-password-input',
  imports: [Icon],
  template: `
    <input
      [id]="inputId()"
      [type]="revealed() ? 'text' : 'password'"
      [attr.autocomplete]="autocomplete()"
      [attr.aria-invalid]="invalid()"
      [attr.aria-describedby]="describedBy()"
      [value]="value()"
      [disabled]="disabled()"
      (input)="onInput($event)"
      (blur)="onTouched()"
    />
    <button
      class="toggle"
      type="button"
      [attr.aria-label]="revealed() ? 'Hide password' : 'Show password'"
      (click)="revealed.set(!revealed())"
    >
      <py-icon [name]="revealed() ? 'eye-off' : 'eye'" />
    </button>
  `,
  styles: `
    .toggle {
      display: grid; place-items: center; width: 24px; height: 24px; margin-right: -6px;
      border: 0; background: transparent; color: var(--py-ink-muted); border-radius: var(--py-radius-sm); cursor: pointer;
    }
    .toggle:hover { color: var(--py-ink); background: var(--py-surface-2); }
  `,
  host: { class: 'py-input-wrap' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInput), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordInput implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly autocomplete = input('current-password');
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected readonly revealed = signal(false);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}

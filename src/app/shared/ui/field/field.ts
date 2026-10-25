import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Label + control + hint/error. Project the input wrapper as content; put a link next to the label with
 * the `fieldAction` attribute.
 */
@Component({
  selector: 'py-field',
  imports: [Icon],
  template: `
    <div class="py-field__row">
      <label class="py-field__label" [attr.for]="for()">{{ label() }}</label>
      <ng-content select="[fieldAction]" />
    </div>
    <ng-content />
    @if (error(); as message) {
      <p class="py-field__error" [id]="for() + '-error'"><py-icon name="alert" />{{ message }}</p>
    } @else if (hint()) {
      <p class="py-field__hint" [id]="for() + '-hint'">{{ hint() }}</p>
    }
  `,
  host: { class: 'py-field', '[class.is-invalid]': '!!error()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Field {
  readonly label = input.required<string>();
  readonly for = input.required<string>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
}

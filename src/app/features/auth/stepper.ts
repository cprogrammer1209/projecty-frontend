import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** "Step n of 2" progress bar shared by sign-up (account) and portal setup. */
@Component({
  selector: 'py-stepper',
  template: `
    <span class="py-caption py-stepper__label">Step {{ step() }} of {{ total }} · {{ label() }}</span>
    <div class="py-stepper__track" role="progressbar" aria-label="Sign-up progress"
         aria-valuemin="1" [attr.aria-valuemax]="total" [attr.aria-valuenow]="step()">
      <div class="py-stepper__fill" [style.width.%]="percent()"></div>
    </div>
  `,
  host: { class: 'py-stepper', style: 'display: block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stepper {
  readonly step = input.required<number>();
  readonly label = input.required<string>();
  protected readonly total = 2;
  protected readonly percent = computed(() => (this.step() / this.total) * 100);
}

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Cell {
  day: number;
  iso: string;
  today: boolean;
}

/**
 * A month calendar for picking one plain date (yyyy-MM-dd). Shows the month of `value` (else today's), with month
 * arrows and, when `clearable`, a "Clear date" row. Emits the picked date, or null for clear.
 */
@Component({
  selector: 'py-calendar',
  template: `
    <div class="cal-h">
      <button type="button" aria-label="Previous month" (click)="move(-1)">‹</button>
      <span aria-live="polite">{{ title() }}</span>
      <button type="button" aria-label="Next month" (click)="move(1)">›</button>
    </div>
    <div class="cal-g">
      @for (d of weekdays; track $index) { <span class="dow">{{ d }}</span> }
      @for (b of blanks(); track $index) { <span></span> }
      @for (c of cells(); track c.iso) {
        <button type="button" [class.sel]="value() === c.iso" [class.today]="c.today" [attr.aria-label]="c.iso" (click)="picked.emit(c.iso)">{{ c.day }}</button>
      }
    </div>
    @if (clearable() && value()) {
      <div class="cf-hint"><button class="opt muted" type="button" (click)="picked.emit(null)">Clear date</button></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  readonly value = input<string | null>(null);
  readonly clearable = input(false);
  readonly picked = output<string | null>();

  protected readonly weekdays = WEEKDAYS;
  private readonly shown = signal<{ y: number; m: number } | null>(null);
  private readonly month = computed(() => {
    const own = this.shown();
    if (own) return own;
    const v = this.value();
    const d = v ? new Date(`${v}T00:00:00`) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  protected readonly title = computed(() => `${MONTHS[this.month().m]} ${this.month().y}`);
  protected readonly blanks = computed(() => Array.from({ length: new Date(this.month().y, this.month().m, 1).getDay() }));
  protected readonly cells = computed<Cell[]>(() => {
    const { y, m } = this.month();
    const now = new Date();
    const days = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      return {
        day,
        iso: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        today: now.getFullYear() === y && now.getMonth() === m && now.getDate() === day,
      };
    });
  });

  protected move(step: number): void {
    const { y, m } = this.month();
    const next = new Date(y, m + step, 1);
    this.shown.set({ y: next.getFullYear(), m: next.getMonth() });
  }
}

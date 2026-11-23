import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PyDayPipe } from '../../../shared/pipes/py-day.pipe';
import { isOverdue } from '../task-ui';
import { TvGlyph, TvOwners, TvUiIcon } from './tv-glyph';
import { PRIO_LABEL, TvTask } from './tv-model';
import { TvStore } from './tv-store';

/** One 36px row. Priority swaps for a checkbox on hover; status, priority, owners and due date are pickers; the title opens the page. */
@Component({
  selector: 'div[tvRow]',
  imports: [RouterLink, TvGlyph, TvOwners, TvUiIcon, PyDayPipe],
  templateUrl: './tv-row.html',
  host: {
    class: 'trow',
    role: 'row',
    '[class.done]': 'task().statusType === "CLOSED"',
    '[class.sub]': '!!task().parentId',
    '[class.focus]': 'store.focus() === task().id',
    '[class.checked]': 'checked()',
    '[attr.data-open]': 'task().id',
    '[attr.data-key]': 'task().key',
    '[attr.aria-label]': 'task().key + " " + task().title',
    '(click)': 'rowClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvRow {
  readonly task = input.required<TvTask>({ alias: 'tvRow' });
  protected readonly store = inject(TvStore);
  protected readonly checked = computed(() => this.store.checked().has(this.task().id));
  protected readonly href = computed(() => this.store.hrefOf(this.task()));
  protected readonly names = computed(() => this.store.ownerNames(this.task()));
  protected readonly statusIcon = computed(() => this.store.taskStatusIcon(this.task()));
  protected readonly overdue = computed(() => isOverdue(this.task(), this.store.data()?.today));
  protected readonly prioLabel = computed(() => PRIO_LABEL[this.task().priority]);

  protected pick(kind: 'status' | 'priority' | 'owner' | 'due', event: Event): void {
    event.stopPropagation();
    const id = this.task().id;
    this.store.focus.set(id);
    const sel = this.store.checked();
    this.store.pick(kind, sel.has(id) && sel.size > 1 ? [...sel] : [id], event.currentTarget as HTMLElement);
  }

  protected check(event: Event): void {
    event.stopPropagation();
    this.store.toggleCheck(this.task().id);
  }

  protected rowClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, label, form')) return;
    this.store.focus.set(this.task().id);
    this.store.openPeek(this.task().id);
  }
}

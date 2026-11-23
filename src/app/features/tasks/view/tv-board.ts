import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PyDayPipe } from '../../../shared/pipes/py-day.pipe';
import { isOverdue } from '../task-ui';
import { TvGlyph, TvOwners, TvUiIcon } from './tv-glyph';
import { PRIO_LABEL, TvGroup, TvTask } from './tv-model';
import { TvQuickAdd } from './tv-quick-add';
import { TvStore } from './tv-store';

/** One card of the board: key, owners, title, priority, subtask count, tag, due date. Draggable where the person may edit. */
@Component({
  selector: 'article[tvCard]',
  imports: [RouterLink, TvGlyph, TvOwners, TvUiIcon, PyDayPipe],
  template: `
    @let t = task();
    <div class="t1">
      <span class="mono">{{ t.key }}</span>
      @if (store.source.portal) { <span class="c-pj">{{ t.projectName }}</span> }
      <span class="sp"></span>
      <button type="button" class="asg" data-pick="owner" aria-label="Owners" title="Owners (A)" draggable="false" (click)="pick('owner', $event)"><py-tv-owners [names]="names()" /></button>
    </div>
    <a class="ct" [routerLink]="href().link" [queryParams]="href().query" draggable="false">{{ t.title }}</a>
    <div class="t2">
      <button type="button" class="si" data-pick="priority" [attr.aria-label]="'Priority: ' + prioLabel()" [title]="'Priority: ' + prioLabel() + ' (P)'" (click)="pick('priority', $event)"><py-tv-glyph [icon]="{ k: 'prio', p: t.priority }" /></button>
      @if (t.subtaskCount) { <span class="subc"><py-tv-icon n="sub" [size]="11" />{{ t.completedSubtaskCount }}/{{ t.subtaskCount }}</span> }
      @if (t.tags[0]; as tag) { <span class="tag">{{ tag }}</span> }
      <span class="sp"></span>
      <button type="button" class="due" data-pick="due" [class.over]="overdue()" [class.none]="!t.dueDate" aria-label="Due date" (click)="pick('due', $event)">
        @if (t.dueDate) { {{ t.dueDate | pyDay }} } @else { <py-tv-icon n="cal" [size]="13" /> }
      </button>
    </div>
  `,
  host: {
    class: 'card',
    '[class.done]': 'task().statusType === "CLOSED"',
    '[class.focus]': 'store.focus() === task().id',
    '[attr.draggable]': 'task().canEdit',
    '[attr.data-card]': 'task().id',
    '[attr.data-open]': 'task().id',
    '[attr.aria-label]': 'task().key + " " + task().title',
    '(click)': 'cardClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvCard {
  readonly task = input.required<TvTask>({ alias: 'tvCard' });
  protected readonly store = inject(TvStore);
  protected readonly href = computed(() => this.store.hrefOf(this.task()));
  protected readonly names = computed(() => this.store.ownerNames(this.task()));
  protected readonly overdue = computed(() => isOverdue(this.task(), this.store.data()?.today));
  protected readonly prioLabel = computed(() => PRIO_LABEL[this.task().priority]);

  protected pick(kind: 'priority' | 'owner' | 'due', event: Event): void {
    event.stopPropagation();
    this.store.focus.set(this.task().id);
    this.store.pick(kind, [this.task().id], event.currentTarget as HTMLElement);
  }

  protected cardClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, label, form')) return;
    this.store.focus.set(this.task().id);
    this.store.openPeek(this.task().id);
  }
}

/** The board: a column per group, cards that drag between columns (native drag and drop) to change what the grouping is about. */
@Component({
  selector: 'py-tv-board',
  imports: [TvGlyph, TvUiIcon, TvCard, TvQuickAdd],
  templateUrl: './tv-board.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvBoard {
  protected readonly store = inject(TvStore);
  private readonly dragging = signal<string | null>(null);
  protected readonly over = signal<string | null>(null);

  protected start(event: DragEvent): void {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (!card) return;
    this.dragging.set(card.dataset['card'] ?? null);
    event.dataTransfer?.setData('text/plain', card.dataset['card'] ?? '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    setTimeout(() => card.classList.add('dragging'));
  }

  protected end(): void {
    this.dragging.set(null);
    this.over.set(null);
    document.querySelectorAll('.card.dragging').forEach((n) => n.classList.remove('dragging'));
  }

  protected dragOver(event: DragEvent, g: TvGroup): void {
    if (!this.dragging()) return;
    event.preventDefault();
    this.over.set(g.id);
  }

  protected drop(event: DragEvent, g: TvGroup): void {
    const id = this.dragging();
    if (!id) return;
    event.preventDefault();
    this.end();
    void this.store.moveTo(id, this.store.groupKey(), g.id);
  }
}

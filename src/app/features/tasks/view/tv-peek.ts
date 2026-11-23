import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TaskDetail } from '../task-detail';
import { TvUiIcon } from './tv-glyph';
import { TvStore } from './tv-store';

/** The side panel (click a row or press Space): the task page in compact mode, with previous / next, full page and close. */
@Component({
  selector: 'py-tv-peek',
  imports: [TvUiIcon, TaskDetail],
  template: `
    @if (task(); as t) {
      <div class="tv-peek-scrim" id="tv-peek" (mousedown)="$event.target === $event.currentTarget && store.closePeek()">
        <aside class="tv-peek" role="dialog" aria-label="Task preview">
          <div class="pk-h">
            <b class="pk-key">{{ t.key }}</b><span class="mut">Peek</span><span class="sp"></span>
            <button class="ibtn" type="button" data-pk="prev" aria-label="Previous task" title="Previous (K)" (click)="store.stepPeek(-1)"><py-tv-icon n="up" /></button>
            <button class="ibtn" type="button" data-pk="next" aria-label="Next task" title="Next (J)" (click)="store.stepPeek(1)"><py-tv-icon n="down" /></button>
            <button class="ibtn" type="button" data-pk="open" aria-label="Open full page" title="Open full page (Enter)" (click)="open()"><py-tv-icon n="expand" /></button>
            <button class="ibtn" type="button" data-pk="close" aria-label="Close preview" title="Close (Esc)" (click)="store.closePeek()"><py-tv-icon n="x" /></button>
          </div>
          <div class="pk-body" id="pk-body">
            <py-task-detail [id]="t.projectId" [tid]="t.id" [from]="store.source.from" [compact]="true" (trashed)="trashed($event)" (subOpen)="store.openPeek($event)" />
          </div>
        </aside>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPeek {
  protected readonly store = inject(TvStore);
  protected readonly task = computed(() => {
    const id = this.store.peek();
    return id ? this.store.byId(id) : undefined;
  });

  protected open(): void {
    const t = this.task();
    if (!t) return;
    this.store.closePeek(false);
    this.store.openPage(t);
  }

  protected trashed(message: string): void {
    this.store.closePeek();
    this.store.setNotice(message);
  }
}

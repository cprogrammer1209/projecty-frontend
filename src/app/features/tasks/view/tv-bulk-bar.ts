import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TvUiIcon } from './tv-glyph';
import { TvStore } from './tv-store';

/** Appears when rows are ticked: change status, owner or priority of all of them at once. */
@Component({
  selector: 'py-tv-bulk',
  imports: [TvUiIcon],
  template: `
    @if (store.checked().size; as n) {
      <div class="selbar" role="toolbar" aria-label="Bulk actions">
        <b>{{ n }} selected</b>
        <button #s class="tb" type="button" data-bulk="status" (click)="pick('status', s)">Status</button>
        <button #o class="tb" type="button" data-bulk="owner" (click)="pick('owner', o)">Owner</button>
        <button #p class="tb" type="button" data-bulk="priority" (click)="pick('priority', p)">Priority</button>
        <button class="ibtn" type="button" data-bulk="clear" aria-label="Clear selection" (click)="store.clearChecked()"><py-tv-icon n="x" /></button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvBulkBar {
  protected readonly store = inject(TvStore);

  protected pick(kind: 'status' | 'owner' | 'priority', anchor: HTMLElement): void {
    this.store.pick(kind, [...this.store.checked()], anchor);
  }
}

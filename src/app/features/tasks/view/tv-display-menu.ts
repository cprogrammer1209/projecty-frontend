import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { TvUiIcon } from './tv-glyph';
import { TvGroupId, TvView } from './tv-model';
import { TvPopup } from './tv-popup';
import { TvStore } from './tv-store';

/** The Display popover: List or Board, the grouping, and what to show (Subtasks, Archived lists, Closed tasks). */
@Component({
  selector: 'py-tv-display-menu',
  imports: [TvPopup, TvUiIcon],
  template: `
    <py-tv-popup [anchor]="anchor()" [alignEnd]="true" cls="disp" (closed)="closed.emit()">
      <div class="pop-t">View</div>
      <div class="seg">
        <button type="button" data-dv="list" [class.on]="state.view() === 'list'" (click)="view('list')"><py-tv-icon n="list" />List</button>
        <button type="button" data-dv="board" [class.on]="state.view() === 'board'" (click)="view('board')"><py-tv-icon n="board" />Board</button>
      </div>
      <div class="pop-t">Grouping</div>
      @for (g of store.groupChoices(); track g.id) {
        <button type="button" class="di" [class.on]="state.group() === g.id" [attr.data-dg]="g.id" (click)="group(g.id)">{{ g.label }}@if (state.group() === g.id) { <span class="pop-tick">✓</span> }</button>
      }
      <div class="pop-t">Show</div>
      <label class="di"><input type="checkbox" id="show-sub" [checked]="state.showSub()" (change)="toggle('sub', $any($event.target).checked)" /><span>Subtasks</span></label>
      @if (!store.source.portal && hasArchived()) {
        <label class="di"><input type="checkbox" id="show-archived" [checked]="state.showArchived()" (change)="toggle('archived', $any($event.target).checked)" /><span>Archived lists</span></label>
      }
      @if (store.source.mine) {
        <label class="di"><input type="checkbox" id="show-closed" [checked]="state.showClosed()" (change)="toggle('closed', $any($event.target).checked)" /><span>Closed tasks</span></label>
      }
    </py-tv-popup>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvDisplayMenu {
  readonly anchor = input.required<HTMLElement>();
  readonly closed = output<void>();
  protected readonly store = inject(TvStore);
  protected readonly state = this.store.state;
  protected readonly hasArchived = computed(() => !!this.store.data()?.lists.some((l) => l.archived));

  protected view(v: TvView): void {
    this.state.view.set(v);
    this.state.save();
  }

  protected group(g: TvGroupId): void {
    this.state.group.set(g);
    this.state.save();
  }

  protected toggle(which: 'sub' | 'archived' | 'closed', on: boolean): void {
    if (which === 'sub') this.state.showSub.set(on);
    else if (which === 'archived') this.state.showArchived.set(on);
    else this.state.showClosed.set(on);
    this.state.save();
  }
}

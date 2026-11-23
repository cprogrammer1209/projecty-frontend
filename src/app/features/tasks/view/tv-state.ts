import { signal } from '@angular/core';

import { TvFilter, TvGroupId, TvView, emptyFilter } from './tv-model';

/**
 * What one screen remembers about its task view: List or Board, the grouping, whether subtasks show and which groups are
 * folded (all kept in localStorage `py-tv-<key>`), plus the filters and the Archived / Closed toggles (kept while the
 * screen lives). A screen creates one per tab and hands it to the view, so switching tabs keeps each tab's state.
 */
export class TvState {
  readonly view = signal<TvView>('list');
  readonly group = signal<TvGroupId>('status');
  readonly showSub = signal(false);
  readonly showArchived = signal(false);
  readonly showClosed = signal(false);
  readonly fold = signal<Record<string, boolean>>({});
  readonly filter = signal<TvFilter>(emptyFilter());

  constructor(
    readonly key: string,
    defaults: { group: TvGroupId; showSub: boolean },
  ) {
    this.group.set(defaults.group);
    this.showSub.set(defaults.showSub);
    try {
      const saved = JSON.parse(localStorage.getItem(`py-tv-${key}`) ?? 'null') as Partial<{ view: TvView; group: TvGroupId; showSub: boolean; fold: Record<string, boolean> }> | null;
      if (saved) {
        if (saved.view === 'list' || saved.view === 'board') this.view.set(saved.view);
        if (saved.group) this.group.set(saved.group);
        if (typeof saved.showSub === 'boolean') this.showSub.set(saved.showSub);
        if (saved.fold && typeof saved.fold === 'object') this.fold.set(saved.fold);
      }
    } catch {
      /* not remembered */
    }
  }

  save(): void {
    try {
      localStorage.setItem(`py-tv-${this.key}`, JSON.stringify({ view: this.view(), group: this.group(), showSub: this.showSub(), fold: this.fold() }));
    } catch {
      /* not remembered */
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TvUiIcon } from './tv-glyph';
import { FILTER_KEYS, TvFilterKey } from './tv-model';
import { TvStore } from './tv-store';

/** Filter, search, a slot for screen buttons (Lists, Trash), Display and New task; below it the removable filter chips. */
@Component({
  selector: 'py-tv-toolbar',
  imports: [TvUiIcon],
  templateUrl: './tv-toolbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvToolbar {
  protected readonly store = inject(TvStore);

  protected readonly chips = computed(() => {
    const f = this.store.state.filter();
    const defs = this.store.filterDefs();
    const out: { key: TvFilterKey | 'q'; label: string; text: string }[] = [];
    if (f.q.trim()) out.push({ key: 'q', label: 'Search', text: f.q.trim() });
    for (const k of FILTER_KEYS) {
      const def = defs.find((d) => d.key === k);
      if (def && f[k].length) out.push({ key: k, label: def.label, text: f[k].map((v) => def.name(v)).join(', ') });
    }
    return out;
  });

  protected openFilter(anchor: HTMLElement): void {
    this.store.toolbarMenu.set(null);
    const cats = this.store.filterDefs();
    this.store.menu.set({
      anchor,
      title: 'Filter',
      items: cats.map((c) => ({ id: c.key, label: c.label })),
      onPick: (k) =>
        setTimeout(() => {
          const key = k as TvFilterKey;
          const label = cats.find((c) => c.key === key)?.label ?? '';
          this.store.menu.set({ anchor, multi: true, search: `${label}…`, items: this.store.filterItems(key), onPick: (v) => this.store.toggleFilter(key, v) });
        }),
    });
  }

  protected openDisplay(anchor: HTMLElement): void {
    const open = this.store.toolbarMenu();
    this.store.menu.set(null);
    this.store.toolbarMenu.set(open ? null : { kind: 'display', anchor });
  }
}

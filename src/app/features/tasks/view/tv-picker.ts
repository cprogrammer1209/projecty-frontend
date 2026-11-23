import { OnInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';

import { TvGlyph } from './tv-glyph';
import { TvItem, TvMenuSpec } from './tv-model';
import { TvPopup } from './tv-popup';

/**
 * A picker menu: optional search, a list with a tick (one choice) or checkboxes (several), arrow keys, Enter, and 1-9
 * for the first nine rows. One choice closes it; several stay open and report every toggle.
 */
@Component({
  selector: 'py-tv-picker',
  imports: [TvPopup, TvGlyph],
  templateUrl: './tv-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPicker implements OnInit {
  readonly spec = input.required<TvMenuSpec>();
  readonly closed = output<void>();

  protected readonly query = signal('');
  protected readonly hi = signal(0);
  protected readonly items = signal<TvItem[]>([]);
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((i) => !q || i.label.toLowerCase().includes(q));
  });
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('s');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.search()?.nativeElement.focus());
    const key = (e: KeyboardEvent): void => {
      const vis = this.visible();
      const swallow = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'ArrowDown') { swallow(); this.hi.set(Math.min(vis.length - 1, this.hi() + 1)); }
      else if (e.key === 'ArrowUp') { swallow(); this.hi.set(Math.max(0, this.hi() - 1)); }
      else if (e.key === 'Enter' && vis[this.hi()]) { swallow(); this.choose(vis[this.hi()]); }
      else if (/^[1-9]$/.test(e.key) && !this.spec().multi && !this.query() && this.spec().num && vis[+e.key - 1]) { swallow(); this.choose(vis[+e.key - 1]); }
    };
    document.addEventListener('keydown', key, true);
    destroyRef.onDestroy(() => document.removeEventListener('keydown', key, true));
  }

  ngOnInit(): void {
    this.items.set(this.spec().items.map((i) => ({ ...i })));
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    this.hi.set(0);
  }

  protected choose(item: TvItem): void {
    const spec = this.spec();
    if (spec.multi) {
      this.items.update((all) => all.map((i) => (i.id === item.id ? { ...i, on: !i.on } : i)));
      spec.onPick(item.id, this.items());
    } else {
      this.closed.emit();
      spec.onPick(item.id, this.items());
    }
  }

  protected date(value: string): void {
    if (!value) return;
    this.closed.emit();
    this.spec().onDate?.(value);
  }
}

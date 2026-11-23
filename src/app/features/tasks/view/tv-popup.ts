import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';

/**
 * The floating shell of every task-view menu: placed under an anchor (flips above when there is no room, stays inside
 * the window), closes on Esc (before anything else sees the key) and on a press outside it and its anchor.
 */
@Component({
  selector: 'py-tv-popup',
  template: `<div #panel class="tv-pop" [class]="cls()" role="menu"><ng-content /></div>`,
  styles: `:host { display: contents; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPopup {
  readonly anchor = input.required<HTMLElement>();
  readonly alignEnd = input(false);
  readonly cls = input('');
  readonly closed = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.panel().nativeElement;
      this.place(el);
      let alive = true;
      const away = (e: MouseEvent): void => {
        const target = e.target as Node;
        if (!el.contains(target) && !this.anchor().contains(target)) this.closed.emit();
      };
      const key = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        e.preventDefault();
        this.closed.emit();
      };
      setTimeout(() => alive && document.addEventListener('mousedown', away, true));
      document.addEventListener('keydown', key, true);
      destroyRef.onDestroy(() => {
        alive = false;
        document.removeEventListener('mousedown', away, true);
        document.removeEventListener('keydown', key, true);
      });
    });
  }

  private place(el: HTMLElement): void {
    const r = this.anchor().getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = this.alignEnd() ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
}

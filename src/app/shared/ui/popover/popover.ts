import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';

/**
 * A floating panel under an anchor element (a button). Content goes inside. It closes on Esc and on a press outside
 * the panel and the anchor, emitting `closed`; the owner decides whether it is open (`open`). It flips above the
 * anchor when there is no room below, and stays inside the window horizontally.
 */
@Component({
  selector: 'py-popover',
  template: `
    @if (open()) {
      <div #panel class="panel" role="dialog" [attr.aria-label]="label()"><ng-content /></div>
    }
  `,
  styles: `
    :host { display: contents; }
    .panel { position: fixed; z-index: 60; min-width: 220px; max-width: min(360px, 92vw); max-height: 70vh; overflow: auto; background: var(--py-surface-0); color: var(--py-ink); border: 1px solid var(--py-border); border-radius: 10px; box-shadow: var(--py-shadow-lg); padding: 6px; }
  `,
  host: {
    '(document:mousedown)': 'outside($event)',
    '(document:keydown.escape)': 'dismiss()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Popover {
  readonly open = input(false);
  readonly anchor = input<HTMLElement | null>(null);
  readonly label = input('');
  readonly alignEnd = input(false);
  readonly closed = output<void>();
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      const panel = this.panel()?.nativeElement;
      const anchor = this.anchor();
      if (!this.open() || !panel || !anchor) return;
      queueMicrotask(() => this.place(panel, anchor));
    });
  }

  private place(panel: HTMLElement, anchor: HTMLElement): void {
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    let left = this.alignEnd() ? r.right - w : r.left;
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  protected outside(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    if (this.panel()?.nativeElement.contains(target) || this.anchor()?.contains(target)) return;
    this.closed.emit();
  }

  protected dismiss(): void {
    if (this.open()) this.closed.emit();
  }
}

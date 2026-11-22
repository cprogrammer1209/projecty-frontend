import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output } from '@angular/core';

/**
 * A modal dialog. Show it with `@if` or the `open` input; content goes inside. Esc and a click on the backdrop emit
 * `closed`. The first field gets focus when it opens. Give it a `label` for screen readers.
 */
@Component({
  selector: 'py-dialog',
  template: `
    @if (open()) {
      <div class="overlay" (mousedown)="onBackdrop($event)">
        <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="label()">
          <ng-content />
        </section>
      </div>
    }
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 70; background: rgba(12, 16, 24, 0.45); display: grid; place-items: center; padding: 16px; overflow-y: auto; }
    .dialog { width: min(var(--py-dialog-width, 480px), 100%); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--py-surface-0); color: var(--py-ink); border: 1px solid var(--py-border); border-radius: 12px; box-shadow: var(--py-shadow-lg); padding: 22px; }
  `,
  host: { '(document:keydown.escape)': 'close()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  readonly open = input(true);
  readonly label = input('');
  readonly closed = output<void>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      if (this.open()) {
        setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus());
      }
    });
  }

  protected close(): void {
    if (this.open()) this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * An icon from the sprite in index.html. `name` is `eye` for `#i-eye`, or a status id like `s-review`.
 * Size it by styling the `py-icon` element (default 16px); the svg fills it.
 */
@Component({
  selector: 'py-icon',
  template: `<svg aria-hidden="true"><use [attr.href]="href()" /></svg>`,
  styles: `
    :host { display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; }
    svg { width: 100%; height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<string>();
  protected readonly href = computed(() =>
    this.name().startsWith('s-') ? `#${this.name()}` : `#i-${this.name()}`,
  );
}

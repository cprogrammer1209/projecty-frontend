import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../../shared/ui/icon/icon';
import { STATUS_LOOK } from './project-labels';

/** A project status as icon + label, never a solid fill (see .py-pill). */
@Component({
  selector: 'py-project-status',
  imports: [Icon],
  template: `<span [class]="'py-pill py-pill--' + look().cls"><py-icon [name]="look().icon" />{{ status() }}</span>`,
  styles: `
    :host { display: inline-block; white-space: nowrap; }
    py-icon { width: 14px; height: 14px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectStatus {
  readonly status = input.required<string>();
  protected readonly look = computed(() => STATUS_LOOK[this.status()] ?? { cls: 'open', icon: 'dot' });
}

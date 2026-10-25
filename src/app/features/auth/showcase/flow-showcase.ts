import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Icon } from '../../../shared/ui/icon/icon';

/** Sign-in pane: a blueprint transition in miniature (a fork between statuses and its checklist). */
@Component({
  selector: 'py-flow-showcase',
  imports: [Icon],
  templateUrl: './flow-showcase.html',
  styleUrl: './flow-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowShowcase {}

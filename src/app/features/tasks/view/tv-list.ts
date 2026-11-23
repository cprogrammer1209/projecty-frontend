import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TvGlyph, TvUiIcon } from './tv-glyph';
import { TvQuickAdd } from './tv-quick-add';
import { TvRow } from './tv-row';
import { TvStore } from './tv-store';

/** The grouped list: a header per group (fold caret, icon, count, add), 36px rows, a quick add form, and a New task row. */
@Component({
  selector: 'py-tv-list',
  imports: [TvGlyph, TvUiIcon, TvRow, TvQuickAdd],
  templateUrl: './tv-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvList {
  protected readonly store = inject(TvStore);
}

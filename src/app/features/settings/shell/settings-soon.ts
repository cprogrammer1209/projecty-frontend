import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { Icon } from '../../../shared/ui/icon/icon';
import { PAGE_ICONS, SOON_MODULES } from './settings-nav';

/** Settings of a module that has not arrived yet (Tasks, Issues, Documents, Time tracking). */
@Component({
  selector: 'py-settings-soon',
  imports: [Icon],
  template: `
    @if (module(); as m) {
      <div class="notice">
        Settings for {{ m.name }} will appear here when the module arrives. {{ m.note }}.
      </div>
      <div class="group grey" aria-disabled="true">
        @for (p of m.pages; track p) {
          <div class="srow">
            <div class="l" style="display: flex; gap: 10px; align-items: center">
              <py-icon [name]="icon(p)" /><b>{{ p }}</b>
            </div>
            <div class="r muted">Not available yet</div>
          </div>
        }
      </div>
    } @else {
      <div class="notice">Page not found. Pick a page from the menu.</div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSoon {
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('module'))),
    { initialValue: null },
  );
  protected readonly module = computed(() => SOON_MODULES.find((m) => m.id === this.id()) ?? null);

  protected icon(page: string): string {
    return PAGE_ICONS[page.toLowerCase()] ?? 'fields';
  }
}

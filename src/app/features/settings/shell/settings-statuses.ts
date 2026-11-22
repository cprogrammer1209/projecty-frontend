import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { ProjectApi } from '../../../core/project/project.api';

const TYPES = ['Active', 'On hold', 'Completed', 'Cancelled'];
const COLORS: Record<string, string> = {
  Active: 'var(--acc)',
  'On hold': 'var(--mut2)',
  Completed: 'var(--ok)',
  Cancelled: 'var(--danger)',
};

/** Statuses grouped by what they mean. Read-only for now; the heading comes from the shell. */
@Component({
  selector: 'py-settings-statuses',
  template: `
    @for (g of groups(); track g.type) {
      <div class="gt">{{ g.type }}</div>
      <div class="group">
        @for (s of g.items; track s.name) {
          <div class="srow" style="padding: 9px 16px">
            <div class="l" style="display: flex; align-items: center; gap: 10px">
              <span class="dot" [style.background]="g.color"></span><b>{{ s.name }}</b>
            </div>
            <div class="r muted">{{ g.type }}</div>
          </div>
        } @empty {
          <div class="srow"><div class="l muted">No statuses of this type.</div></div>
        }
      </div>
    }
    <p class="foot">Editing statuses arrives with the statuses part of this step.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsStatuses {
  private readonly statuses = toSignal(inject(ProjectApi).statuses(), { initialValue: [] });
  protected readonly groups = computed(() =>
    TYPES.map((type) => ({
      type,
      color: COLORS[type],
      items: this.statuses().filter((s) => s.type === type),
    })),
  );
}

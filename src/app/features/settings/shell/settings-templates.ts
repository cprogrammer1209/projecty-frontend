import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder: project templates arrive with a later step. The heading comes from the shell. */
@Component({
  selector: 'py-settings-templates',
  template: `
    <div class="group">
      <div class="srow">
        <div class="l">
          <b>No templates yet</b>
          <span
            >Project templates (phases, tasks and documents to start from) arrive with a later
            step.</span
          >
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsTemplates {}

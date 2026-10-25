import { Component } from '@angular/core';

import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'py-support-ended',
  imports: [Icon],
  template: `
    <section aria-labelledby="ended-title">
      <div class="py-badge-icon"><py-icon name="check" /></div>
      <div class="py-view-head">
        <h1 class="py-title" id="ended-title">Support session ended</h1>
        <p class="py-body">You're signed out of the user's account. You can close this tab.</p>
      </div>
    </section>
  `,
})
export class SupportEnded {}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ImpersonationBanner } from './features/support/impersonation-banner/impersonation-banner';

@Component({
  selector: 'py-root',
  imports: [RouterOutlet, ImpersonationBanner],
  template: '<py-impersonation-banner /><router-outlet />',
})
export class App {}

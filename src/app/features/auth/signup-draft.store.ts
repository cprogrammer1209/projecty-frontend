import { Injectable, signal } from '@angular/core';

/**
 * What the user has typed so far in sign-up and portal setup. Drives the live portal preview, and tells
 * the check-email screen which address to resend to.
 */
@Injectable({ providedIn: 'root' })
export class SignupDraftStore {
  readonly fullName = signal('');
  readonly email = signal('');
  readonly portalName = signal('');
  readonly slug = signal('');
}

import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { Icon } from '../../../shared/ui/icon/icon';
import { resendCooldown } from '../resend-cooldown';
import { SignupDraftStore } from '../signup-draft.store';

@Component({
  selector: 'py-check-email',
  imports: [RouterLink, Icon],
  templateUrl: './check-email.html',
})
export class CheckEmail {
  private readonly accountApi = inject(AccountApi);
  private readonly draft = inject(SignupDraftStore);
  private readonly router = inject(Router);

  protected readonly email = this.draft.email;
  protected readonly cooldown = resendCooldown();
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected resend(): void {
    this.busy.set(true);
    this.error.set(null);
    this.accountApi.resendVerification(this.email()).subscribe({
      next: () => {
        this.busy.set(false);
        this.cooldown.start();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }

  protected useDifferentEmail(): void {
    this.draft.email.set('');
    this.router.navigateByUrl('/sign-up');
  }
}

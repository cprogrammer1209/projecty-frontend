import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { Icon } from '../../../shared/ui/icon/icon';

type VerifyState = 'verifying' | 'verified' | 'expired' | 'failed';

/** Landing page for the link in the verification email: /verify-email?token=... */
@Component({
  selector: 'py-verify-email',
  imports: [RouterLink, Icon],
  templateUrl: './verify-email.html',
})
export class VerifyEmail implements OnInit {
  private readonly accountApi = inject(AccountApi);

  /** Bound from the query string (withComponentInputBinding). */
  readonly token = input<string>();

  protected readonly state = signal<VerifyState>('verifying');
  protected readonly message = signal('');

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('expired');
      return;
    }
    this.accountApi.verifyEmail(token).subscribe({
      next: () => this.state.set('verified'),
      error: (err: ApiError) => {
        if (err.code === 'TOKEN_INVALID_OR_EXPIRED') {
          this.state.set('expired');
        } else {
          this.message.set(err.message);
          this.state.set('failed');
        }
      },
    });
  }
}

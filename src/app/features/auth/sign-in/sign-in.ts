import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { AuthService } from '../../../core/auth/auth.service';
import { Field } from '../../../shared/ui/field/field';
import { controlError, focusFirstInvalid } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { PasswordInput } from '../../../shared/ui/password-input/password-input';
import { EMAIL_PATTERN } from '../text';

type SignInAlert =
  | { kind: 'credentials' }
  | { kind: 'unverified'; resent: boolean }
  | { kind: 'message'; text: string };

@Component({
  selector: 'py-sign-in',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PasswordInput],
  templateUrl: './sign-in.html',
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly accountApi = inject(AccountApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Where to go after signing in, e.g. back to an invitation (?returnUrl=/invite?token=...). */
  readonly returnUrl = input<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', Validators.required],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly alert = signal<SignInAlert | null>(null);

  protected emailError(): string | null {
    return controlError(this.form.controls.email, this.submitted(), {
      required: 'Enter your work email.',
      pattern: 'Enter an email like name@company.com.',
    });
  }

  protected passwordError(): string | null {
    return controlError(this.form.controls.password, this.submitted(), {
      required: 'Enter your password.',
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.login(email.trim(), password).subscribe({
      next: (me) => this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? this.auth.landingUrl(me.portals)),
      error: (err: ApiError) => {
        this.busy.set(false);
        this.alert.set(toAlert(err));
      },
    });
  }

  protected resendVerification(): void {
    this.accountApi.resendVerification(this.form.controls.email.value.trim()).subscribe({
      next: () => this.alert.set({ kind: 'unverified', resent: true }),
      error: (err: ApiError) => this.alert.set({ kind: 'message', text: err.message }),
    });
  }
}

function toAlert(err: ApiError): SignInAlert {
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return { kind: 'credentials' };
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'unverified', resent: false };
    case 'ACCOUNT_LOCKED': {
      const until = new Date(String(err.details['lockedUntil']));
      const time = isNaN(until.getTime())
        ? 'a few minutes'
        : until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return { kind: 'message', text: `Too many failed attempts. Try again after ${time}, or reset your password.` };
    }
    case 'ACCOUNT_DISABLED':
      return { kind: 'message', text: 'This account is disabled. Contact your portal admin.' };
    default:
      return { kind: 'message', text: err.message };
  }
}

/** Only same-app paths, so the parameter can't send people to another site. */
function safeReturnUrl(url: string | undefined): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

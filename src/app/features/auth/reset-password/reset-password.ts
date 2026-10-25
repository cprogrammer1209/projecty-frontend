import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { Field } from '../../../shared/ui/field/field';
import { applyServerErrors, controlError, focusFirstInvalid, setServerError } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { PasswordInput } from '../../../shared/ui/password-input/password-input';
import { PASSWORD_MIN_LENGTH } from '../password-rules';

type ResetState = 'form' | 'done' | 'expired';

/** Landing page for the link in the reset email: /reset-password?token=... */
@Component({
  selector: 'py-reset-password',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PasswordInput],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly accountApi = inject(AccountApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bound from the query string (withComponentInputBinding). */
  readonly token = input<string>();

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly state = signal<ResetState>('form');
  protected readonly alert = signal<string | null>(null);

  protected passwordError(): string | null {
    return controlError(this.form.controls.newPassword, this.submitted(), {
      required: 'Choose a new password.',
      minlength: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  protected lengthMet(): boolean {
    return this.form.controls.newPassword.value.length >= PASSWORD_MIN_LENGTH;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    const token = this.token();
    if (!token) {
      this.state.set('expired');
      return;
    }
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.busy.set(true);
    this.accountApi.resetPassword(token, this.form.controls.newPassword.value).subscribe({
      next: () => this.state.set('done'),
      error: (err: ApiError) => {
        this.busy.set(false);
        if (err.code === 'TOKEN_INVALID_OR_EXPIRED') {
          this.state.set('expired');
        } else if (err.code === 'WEAK_PASSWORD') {
          setServerError(this.form.controls.newPassword, err.message);
          focusFirstInvalid(this.host.nativeElement);
        } else if (!(err.code === 'VALIDATION_FAILED' && applyServerErrors(this.form, err.details))) {
          this.alert.set(err.message);
        }
      },
    });
  }
}

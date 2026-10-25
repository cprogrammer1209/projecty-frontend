import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { Field } from '../../../shared/ui/field/field';
import { controlError, focusFirstInvalid } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { EMAIL_PATTERN } from '../text';

@Component({
  selector: 'py-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly accountApi = inject(AccountApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly alert = signal<string | null>(null);

  protected emailError(): string | null {
    return controlError(this.form.controls.email, this.submitted(), {
      required: 'Enter your work email.',
      pattern: 'Enter an email like name@company.com.',
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const email = this.form.controls.email.value.trim();
    this.busy.set(true);
    this.accountApi.forgotPassword(email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo.set(email);
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.alert.set(err.message);
      },
    });
  }
}

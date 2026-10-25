import { Component, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api.types';
import { AccountApi } from '../../../core/auth/account.api';
import { Field } from '../../../shared/ui/field/field';
import { applyServerErrors, controlError, focusFirstInvalid, setServerError } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { PasswordInput } from '../../../shared/ui/password-input/password-input';
import { PASSWORD_MIN_LENGTH } from '../password-rules';
import { SignupDraftStore } from '../signup-draft.store';
import { Stepper } from '../stepper';
import { EMAIL_PATTERN } from '../text';

/** Step 1 of 2: create the account. Step 2 (the portal) comes after the email is verified. */
@Component({
  selector: 'py-sign-up',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PasswordInput, Stepper],
  templateUrl: './sign-up.html',
})
export class SignUp {
  private readonly accountApi = inject(AccountApi);
  private readonly draft = inject(SignupDraftStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: [this.draft.fullName(), [Validators.required, Validators.maxLength(200)]],
    email: [this.draft.email(), [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly alert = signal<string | null>(null);
  protected readonly emailTaken = signal(false);

  constructor() {
    this.form.controls.fullName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((name) => this.draft.fullName.set(name));
    this.form.controls.email.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emailTaken.set(false));
  }

  protected nameError(): string | null {
    return controlError(this.form.controls.fullName, this.submitted(), {
      required: 'Enter your full name.',
      maxlength: 'Use 200 characters or fewer.',
    });
  }

  protected emailError(): string | null {
    return controlError(this.form.controls.email, this.submitted(), {
      required: 'Enter your work email.',
      pattern: 'Enter an email like name@company.com.',
    });
  }

  protected passwordError(): string | null {
    return controlError(this.form.controls.password, this.submitted(), {
      required: 'Create a password.',
      minlength: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  protected lengthMet(): boolean {
    return this.form.controls.password.value.length >= PASSWORD_MIN_LENGTH;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.accountApi.signup(fullName.trim(), email.trim(), password).subscribe({
      next: () => {
        this.draft.email.set(email.trim());
        this.router.navigateByUrl('/check-email');
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.showError(err);
        focusFirstInvalid(this.host.nativeElement);
      },
    });
  }

  private showError(err: ApiError): void {
    switch (err.code) {
      case 'EMAIL_TAKEN':
        setServerError(this.form.controls.email, 'An account already exists for this email.');
        this.emailTaken.set(true);
        return;
      case 'WEAK_PASSWORD':
        setServerError(this.form.controls.password, err.message);
        return;
      case 'VALIDATION_FAILED':
        if (applyServerErrors(this.form, err.details)) {
          return;
        }
        break;
    }
    this.alert.set(err.message);
  }
}

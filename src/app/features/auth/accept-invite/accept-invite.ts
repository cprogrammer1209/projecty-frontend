import { Component, ElementRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { AcceptedInvitation, InvitationPreview, MemberApi } from '../../../core/member/member.api';
import { Field } from '../../../shared/ui/field/field';
import { controlError, focusFirstInvalid, setServerError } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { PasswordInput } from '../../../shared/ui/password-input/password-input';
import { PASSWORD_MIN_LENGTH } from '../password-rules';

/**
 * The link in an invitation email: /invite?token=... (USR-US-02). Someone new creates an account here; an
 * existing user joins with their login.
 */
@Component({
  selector: 'py-accept-invite',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PasswordInput],
  templateUrl: './accept-invite.html',
})
export class AcceptInvite implements OnInit {
  private readonly memberApi = inject(MemberApi);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bound from the query string (withComponentInputBinding). */
  readonly token = input<string>();

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  /** Signed in as the invited address: one click to join. */
  protected readonly signedInAsInvitee = computed(
    () => this.auth.me()?.email.toLowerCase() === this.preview()?.email.toLowerCase(),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.loadError.set('This invitation link is incomplete.');
      return;
    }
    this.memberApi.preview(token).subscribe({
      next: (preview) => this.preview.set(preview),
      error: (err: ApiError) => this.loadError.set(err.message),
    });
  }

  /** Back here after signing in. */
  protected returnUrl(): string {
    return `/invite?token=${encodeURIComponent(this.token() ?? '')}`;
  }

  protected nameError(): string | null {
    return controlError(this.form.controls.fullName, this.submitted(), { required: 'Enter your full name.' });
  }

  protected passwordError(): string | null {
    return controlError(this.form.controls.password, this.submitted(), {
      required: 'Create a password.',
      minlength: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  /** New account: create it with the invitation, then sign in with the new password. */
  protected createAndJoin(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { fullName, password } = this.form.getRawValue();
    const email = this.preview()!.email;
    this.busy.set(true);
    this.memberApi
      .acceptAsNewUser(this.token()!, fullName.trim(), password)
      .pipe(switchMap((joined) => this.auth.login(email, password).pipe(switchMap(() => [joined]))))
      .subscribe({
        next: (joined) => this.enter(joined),
        error: (err: ApiError) => {
          this.busy.set(false);
          if (err.code === 'WEAK_PASSWORD') {
            setServerError(this.form.controls.password, err.message);
            focusFirstInvalid(this.host.nativeElement);
          } else {
            this.error.set(err.message);
          }
        },
      });
  }

  /** Existing account, signed in as the invitee. The new portal shows up in the token after a refresh. */
  protected join(): void {
    this.busy.set(true);
    this.error.set(null);
    this.memberApi
      .accept(this.token()!)
      .pipe(switchMap((joined) => this.auth.refresh().pipe(switchMap(() => this.auth.loadMe()), switchMap(() => [joined]))))
      .subscribe({
        next: (joined) => this.enter(joined),
        error: (err: ApiError) => {
          this.busy.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected signOut(): void {
    this.auth.logout().subscribe();
  }

  private enter(joined: AcceptedInvitation): void {
    this.router.navigateByUrl(`/p/${joined.portalSlug}`);
  }
}

import { Component, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, debounceTime, map, switchMap, tap } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { PortalApi } from '../../../core/portal/portal.api';
import { Field } from '../../../shared/ui/field/field';
import { applyServerErrors, controlError, focusFirstInvalid, setServerError } from '../../../shared/ui/form-errors';
import { Icon } from '../../../shared/ui/icon/icon';
import { SignupDraftStore } from '../signup-draft.store';
import { Stepper } from '../stepper';
import { slugify } from '../text';

/** Same rules as the backend's SlugRulesHelper; the server still has the final say (reserved, taken). */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SLUG_MIN = 3;
const SLUG_MAX = 30;
const SLUG_CHECK_DELAY_MS = 350;

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; slug: string }
  | { kind: 'unavailable'; suggestions: string[] };

/** Step 2 of 2 (or "Create a portal" from the picker). Signed-in users only. */
@Component({
  selector: 'py-create-portal',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, Stepper],
  templateUrl: './create-portal.html',
  styleUrl: './create-portal.scss',
})
export class CreatePortal {
  private readonly auth = inject(AuthService);
  private readonly portalApi = inject(PortalApi);
  private readonly draft = inject(SignupDraftStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** First portal → part of sign-up, so show the stepper. */
  protected readonly firstPortal = (this.auth.me()?.portals.length ?? 0) === 0;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    slug: [
      '',
      [Validators.required, Validators.minLength(SLUG_MIN), Validators.maxLength(SLUG_MAX), Validators.pattern(SLUG_PATTERN)],
    ],
    terms: [false, Validators.requiredTrue],
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly alert = signal<string | null>(null);
  protected readonly slugStatus = signal<SlugStatus>({ kind: 'idle' });
  private slugEdited = false;

  constructor() {
    this.draft.fullName.set(this.auth.me()?.fullName ?? '');
    this.draft.portalName.set('');
    this.draft.slug.set('');
    const { name, slug } = this.form.controls;

    name.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.draft.portalName.set(value);
      if (!this.slugEdited) {
        slug.setValue(slugify(value));
      }
    });

    slug.valueChanges
      .pipe(
        tap((value) => {
          const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (clean !== value) {
            slug.setValue(clean, { emitEvent: false });
          }
          this.draft.slug.set(clean);
          this.slugStatus.set({ kind: slug.valid ? 'checking' : 'idle' });
        }),
        debounceTime(SLUG_CHECK_DELAY_MS),
        switchMap(() => (slug.valid ? this.checkSlug(slug.value) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Typing in the address stops it following the name; clearing it lets the name drive it again. */
  protected onSlugTyped(): void {
    this.slugEdited = this.form.controls.slug.value.length > 0;
  }

  protected useSuggestion(suggestion: string): void {
    this.slugEdited = true;
    this.form.controls.slug.setValue(suggestion);
  }

  protected nameError(): string | null {
    return controlError(this.form.controls.name, this.submitted(), {
      required: 'Name your portal. You can rename it later.',
      maxlength: 'Use 100 characters or fewer.',
    });
  }

  protected slugError(): string | null {
    return controlError(this.form.controls.slug, this.submitted(), {
      required: 'Choose a portal address.',
      minlength: `Use at least ${SLUG_MIN} characters.`,
      maxlength: `Use ${SLUG_MAX} characters or fewer.`,
      pattern: "Use letters, numbers and hyphens; it can't start or end with a hyphen.",
    });
  }

  protected termsError(): string | null {
    return controlError(this.form.controls.terms, this.submitted(), {
      required: 'Accept the terms to create your portal.',
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { name, slug } = this.form.getRawValue();
    this.busy.set(true);
    this.portalApi
      .create(name.trim(), slug)
      .pipe(
        // The new portal only appears in the access token after a refresh.
        switchMap((portal) => this.auth.refresh().pipe(switchMap(() => this.auth.loadMe()), map(() => portal))),
      )
      .subscribe({
        next: (portal) => this.router.navigateByUrl(`/p/${portal.slug}`),
        error: (err: ApiError) => {
          this.busy.set(false);
          this.showError(err);
          focusFirstInvalid(this.host.nativeElement);
        },
      });
  }

  private checkSlug(value: string) {
    return this.portalApi.slugAvailability(value).pipe(
      tap((result) => {
        if (result.available) {
          this.slugStatus.set({ kind: 'available', slug: value });
        } else {
          setServerError(this.form.controls.slug, result.reason ?? 'This address is not available.');
          this.slugStatus.set({ kind: 'unavailable', suggestions: result.suggestions });
        }
      }),
      // A failed check isn't fatal; the create call validates again.
      catchError(() => {
        this.slugStatus.set({ kind: 'idle' });
        return EMPTY;
      }),
    );
  }

  private showError(err: ApiError): void {
    const slug = this.form.controls.slug;
    switch (err.code) {
      case 'SLUG_TAKEN':
      case 'SLUG_INVALID': {
        setServerError(slug, err.message);
        const suggestions = err.details['suggestions'];
        this.slugStatus.set({ kind: 'unavailable', suggestions: Array.isArray(suggestions) ? suggestions : [] });
        return;
      }
      case 'PORTAL_LIMIT':
        this.alert.set("You've reached the maximum number of portals.");
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

import { Component, ElementRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, debounceTime, map, startWith, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { PortalPeople } from '../../core/member/portal-people.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { Project, ProjectApi, ProjectVisibility } from '../../core/project/project.api';
import { PyDayPipe } from '../../shared/pipes/py-day.pipe';
import { Field } from '../../shared/ui/field/field';
import { applyServerErrors, controlError, focusFirstInvalid, setServerError } from '../../shared/ui/form-errors';
import { Icon } from '../../shared/ui/icon/icon';
import { KEY_CHECK_DELAY_MS, KEY_PATTERN, suggestKey } from './project-key';

type KeyStatus = { kind: 'idle' } | { kind: 'checking' } | { kind: 'available' } | { kind: 'taken' };

const DATES_ORDER = 'datesOrder';
const DATES_MESSAGE = "The end date can't be before the start date.";

/** PRJ-BR-02: the end date can't be before the start date (both are optional). */
function datesInOrder(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string;
  const end = group.get('endDate')?.value as string;
  return start && end && end < start ? { [DATES_ORDER]: true } : null;
}

/**
 * One full page for creating (`/projects/new`) and editing (`/projects/:id/edit`) a project (PRJ-US-01, 02).
 * The key is suggested from the name, checked while typing, and locked once the project exists (PRJ-BR-01).
 */
@Component({
  selector: 'py-project-form',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PyDayPipe],
  templateUrl: './project-form.html',
  styleUrl: './projects.scss',
})
export class ProjectForm implements OnInit {
  /** The project id from the route; absent when creating. */
  readonly id = input<string>();

  protected readonly auth = inject(AuthService);
  private readonly projectApi = inject(ProjectApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly active = inject(ActivePortalService);
  protected readonly people = inject(PortalPeople);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      key: ['', [Validators.required, Validators.pattern(KEY_PATTERN)]],
      ownerUserId: [this.auth.me()?.id ?? ''],
      startDate: [''],
      endDate: [''],
      visibility: ['PRIVATE' as ProjectVisibility, Validators.required],
      description: ['', Validators.maxLength(5000)],
    },
    { validators: datesInOrder },
  );
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly alert = signal<string | null>(null);
  protected readonly keyStatus = signal<KeyStatus>({ kind: 'idle' });
  /** The project being edited; null when creating. */
  protected readonly project = signal<Project | null>(null);
  protected readonly loading = signal(false);
  protected readonly missing = signal(false);
  protected readonly forbidden = signal(false);
  private keyEdited = false;

  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly preview = computed(() => {
    const v = this.value();
    const key = v.key || 'KEY';
    return {
      key,
      name: v.name.trim() || 'Untitled project',
      owner: this.people.nameOf(v.ownerUserId),
      visibility: v.visibility,
      start: v.startDate,
      end: v.endDate,
      firstItem: `${key}-T1`,
    };
  });

  constructor() {
    const { name, key } = this.form.controls;

    name.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (!this.id() && !this.keyEdited) {
        key.setValue(suggestKey(value));
      }
    });

    key.valueChanges
      .pipe(
        tap((value) => {
          const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (clean !== value) {
            key.setValue(clean, { emitEvent: false });
          }
          this.keyStatus.set({ kind: key.valid && !this.id() ? 'checking' : 'idle' });
        }),
        debounceTime(KEY_CHECK_DELAY_MS),
        switchMap(() => (key.valid && !this.id() ? this.checkKey(key.value) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.people.load();
    const id = this.id();
    if (id) {
      this.loadProject(id);
    }
  }

  protected backLink(): string[] {
    const slug = this.active.portal()?.slug ?? '';
    const id = this.id();
    return id ? ['/p', slug, 'projects', id] : ['/p', slug, 'projects'];
  }

  /** Typing in the key stops it following the name; clearing it lets the name drive it again. */
  protected onKeyTyped(): void {
    this.keyEdited = this.form.controls.key.value.length > 0;
  }

  protected nameError(): string | null {
    return controlError(this.form.controls.name, this.submitted(), {
      required: 'Name the project.',
      maxlength: 'Use 100 characters or fewer.',
    });
  }

  protected keyError(): string | null {
    return controlError(this.form.controls.key, this.submitted(), {
      required: 'Choose a key.',
      pattern: 'Use 2 to 10 capital letters or numbers.',
    });
  }

  protected endError(): string | null {
    const end = this.form.controls.endDate;
    const order = this.form.hasError(DATES_ORDER) && (end.touched || this.submitted());
    return controlError(end, this.submitted(), {}) ?? (order ? DATES_MESSAGE : null);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.alert.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    const input = {
      name: v.name.trim(),
      ownerUserId: v.ownerUserId || null,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      visibility: v.visibility,
      description: v.description,
    };
    const id = this.id();
    this.busy.set(true);
    const saved = id
      ? this.projectApi.update(id, input).pipe(map(() => id))
      : this.projectApi.create({ ...input, key: v.key }).pipe(map((created) => created.id));
    saved.subscribe({
      next: (projectId) =>
        this.router.navigate(['/p', this.active.portal()?.slug, 'projects', projectId], {
          state: { notice: id ? 'Project updated.' : 'Project created. You are its owner and Manager.' },
        }),
      error: (err: ApiError) => {
        this.busy.set(false);
        this.showError(err);
        focusFirstInvalid(this.host.nativeElement);
      },
    });
  }

  private loadProject(id: string): void {
    this.loading.set(true);
    this.projectApi.get(id).subscribe({
      next: ({ project }) => {
        this.loading.set(false);
        if (!project.canEdit) {
          this.forbidden.set(true);
          return;
        }
        this.project.set(project);
        this.keyEdited = true;
        this.form.patchValue({
          name: project.name,
          key: project.key,
          ownerUserId: project.ownerUserId,
          startDate: project.startDate ?? '',
          endDate: project.endDate ?? '',
          visibility: project.visibility,
          description: project.description,
        });
        this.form.controls.key.disable();
        this.form.markAsPristine();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        if (err.code === 'PROJECT_NOT_FOUND') {
          this.missing.set(true);
        } else {
          this.alert.set(err.message);
        }
      },
    });
  }

  private checkKey(value: string) {
    return this.projectApi.keyAvailability(value).pipe(
      tap((result) => {
        if (result.available) {
          this.keyStatus.set({ kind: 'available' });
        } else {
          setServerError(this.form.controls.key, 'That key is already used in this portal.');
          this.keyStatus.set({ kind: 'taken' });
        }
      }),
      // A failed check isn't fatal; creating validates again.
      catchError(() => {
        this.keyStatus.set({ kind: 'idle' });
        return EMPTY;
      }),
    );
  }

  private showError(err: ApiError): void {
    switch (err.code) {
      case 'PROJECT_KEY_TAKEN':
        setServerError(this.form.controls.key, err.message);
        this.keyStatus.set({ kind: 'taken' });
        return;
      case 'PROJECT_DATES_INVALID':
        setServerError(this.form.controls.endDate, err.message);
        return;
      case 'PROJECT_PERSON_INVALID':
        setServerError(this.form.controls.ownerUserId, err.message);
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

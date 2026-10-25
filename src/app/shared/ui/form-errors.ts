import { AbstractControl, FormGroup } from '@angular/forms';

/** Server-side message stored on a control by {@link applyServerErrors}; cleared on the next edit. */
export const SERVER_ERROR = 'server';

/**
 * The message to show under a control, or null. Shows after the control is touched or the form was
 * submitted. `messages` maps validator keys (`required`, `email`, ...) to text, checked in order.
 */
export function controlError(
  control: AbstractControl,
  submitted: boolean,
  messages: Record<string, string>,
): string | null {
  if (!control.errors || !(control.touched || submitted)) {
    return null;
  }
  const server = control.errors[SERVER_ERROR];
  if (typeof server === 'string') {
    return server;
  }
  const key = Object.keys(messages).find((k) => control.errors?.[k]);
  return key ? messages[key] : null;
}

/** Puts a server message on one control. */
export function setServerError(control: AbstractControl, message: string): void {
  control.setErrors({ ...control.errors, [SERVER_ERROR]: message });
  control.markAsTouched();
}

/**
 * Applies VALIDATION_FAILED `details` (field → message) to matching controls. `fieldMap` renames
 * backend fields to form controls. Returns false if no field matched.
 */
export function applyServerErrors(
  form: FormGroup,
  details: Record<string, unknown>,
  fieldMap: Record<string, string> = {},
): boolean {
  let applied = false;
  for (const [field, message] of Object.entries(details)) {
    const control = form.get(fieldMap[field] ?? field);
    if (control && typeof message === 'string') {
      setServerError(control, message);
      applied = true;
    }
  }
  return applied;
}

/** Moves focus to the first invalid input inside `root`, after the error state has rendered. */
export function focusFirstInvalid(root: HTMLElement): void {
  setTimeout(() => root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

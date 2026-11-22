import { CanDeactivateFn } from '@angular/router';

/** Implemented by a screen that has edits it would lose when leaving. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a screen with unsaved changes. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || window.confirm('You have unsaved changes. Leave without saving?');

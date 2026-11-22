import { Injectable, signal } from '@angular/core';

/**
 * The floating "Unsaved changes" bar of the settings shell. A screen with something to save sets it with `show()`
 * and removes it with `hide()`; the shell draws it and calls `save()` / `discard()` back.
 */
@Injectable({ providedIn: 'root' })
export class SaveBarService {
  readonly visible = signal(false);
  readonly saveDisabled = signal(false);
  readonly saving = signal(false);
  private onSave: () => void = () => undefined;
  private onDiscard: () => void = () => undefined;

  show(handlers: { save: () => void; discard: () => void }, saveDisabled = false): void {
    this.onSave = handlers.save;
    this.onDiscard = handlers.discard;
    this.saveDisabled.set(saveDisabled);
    this.visible.set(true);
  }

  hide(): void {
    this.visible.set(false);
    this.saving.set(false);
  }

  save(): void {
    this.onSave();
  }

  discard(): void {
    this.onDiscard();
  }
}

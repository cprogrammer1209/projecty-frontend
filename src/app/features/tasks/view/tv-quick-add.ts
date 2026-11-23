import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';

import { Icon } from '../../../shared/ui/icon/icon';
import { TvUiIcon } from './tv-glyph';
import { TvStore } from './tv-store';

/** The one-line "Task title, then Enter" form of a group or column (portal: with a project picker). */
@Component({
  selector: 'form[tvQuickAdd]',
  imports: [Icon, TvUiIcon],
  template: `
    @let qa = store.quickAdd();
    <span class="plus" aria-hidden="true"><py-tv-icon n="plus" [size]="13" /></span>
    @if (store.source.portal) {
      <select class="py-select" name="projectId" aria-label="Project" (change)="project($any($event.target).value)">
        @for (p of projects(); track p.id) { <option [value]="p.id" [selected]="p.id === qa?.projectId">{{ p.name }}</option> }
      </select>
    }
    <input #i type="text" name="title" placeholder="Task title, then Enter" aria-label="Add a task" maxlength="200" autocomplete="off" [disabled]="!!qa?.busy" (keydown.escape)="store.quickAdd.set(null)" />
    @if (qa?.error; as message) { <p class="py-field__error"><py-icon name="alert" />{{ message }}</p> }
  `,
  host: { class: 'qadd', novalidate: '', '(submit)': 'submit($event)', '(focusout)': 'leave($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvQuickAdd {
  readonly gid = input.required<string>({ alias: 'tvQuickAdd' });
  protected readonly store = inject(TvStore);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('i');
  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  protected readonly projects = () => this.store.data()?.projects.filter((p) => p.canCreate) ?? [];

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
    // after each save the field is empty (or holds the title again on an error) and ready for the next one
    effect(() => {
      const qa = this.store.quickAdd();
      if (!qa || qa.busy) return;
      queueMicrotask(() => {
        const el = this.input().nativeElement;
        el.value = qa.text;
        el.focus();
      });
    });
  }

  protected project(id: string): void {
    this.store.quickAdd.update((q) => (q ? { ...q, projectId: id } : q));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.store.submitQuickAdd(this.input().nativeElement.value);
  }

  /** Leaving an empty form closes it. */
  protected leave(event: FocusEvent): void {
    const form = this.host.nativeElement;
    if (event.relatedTarget && form.contains(event.relatedTarget as Node)) return;
    setTimeout(() => {
      if (form.isConnected && !form.contains(document.activeElement) && !this.input().nativeElement.value.trim() && !this.store.menu()) this.store.quickAdd.set(null);
    }, 120);
  }
}

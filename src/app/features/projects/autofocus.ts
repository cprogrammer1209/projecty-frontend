import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Focuses its element when it appears and puts the caret at the end (inline editors and popover search boxes). */
@Directive({ selector: '[pyAutofocus]' })
export class Autofocus implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    node.focus({ preventScroll: true });
    if (node.type !== 'number' && node.setSelectionRange) {
      const end = node.value.length;
      try {
        node.setSelectionRange(end, end);
      } catch {
        /* date and number inputs have no caret */
      }
    }
  }
}

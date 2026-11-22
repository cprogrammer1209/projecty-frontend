import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: '' | 'err';
}

const TOAST_MS = 2400;
const TOAST_ERROR_MS = 4200;

/** Small messages ("Layout saved") shown by the settings shell. Errors stay a little longer. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private next = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, kind: '' | 'err' = ''): void {
    const id = this.next++;
    this.toasts.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== id)), kind ? TOAST_ERROR_MS : TOAST_MS);
  }
}

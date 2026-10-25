import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'py-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Light/dark theme. Follows the OS until the user picks one; the pick is saved and applied before first
 * paint by the inline script in index.html.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly media = matchMedia(DARK_QUERY);
  private readonly current = signal<Theme>(this.effective());

  readonly theme = this.current.asReadonly();

  constructor() {
    this.media.addEventListener('change', () => this.current.set(this.effective()));
  }

  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    this.current.set(next);
  }

  private effective(): Theme {
    const forced = this.root.getAttribute('data-theme');
    if (forced === 'light' || forced === 'dark') {
      return forced;
    }
    return this.media.matches ? 'dark' : 'light';
  }
}

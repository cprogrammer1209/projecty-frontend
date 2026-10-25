import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'py-logo',
  imports: [RouterLink],
  template: `
    <a class="logo" routerLink="/" aria-label="ProjectY home">
      <svg class="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#2A5BD7" />
        <path d="M19 16 L32 31 L45 16 M32 31 V48" fill="none" stroke="#FFFFFF" stroke-width="6"
              stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="32" cy="31" r="6.5" fill="#FFB547" stroke="#2A5BD7" stroke-width="2.5" />
      </svg>
      <span class="logo__word">ProjectY</span>
    </a>
  `,
  styles: `
    .logo { display: inline-flex; align-items: center; gap: 12px; color: var(--py-ink); }
    .logo:hover { text-decoration: none; color: var(--py-ink); }
    .logo__mark { width: 24px; height: 24px; }
    .logo__word { font: 600 15px/1 var(--py-font-ui); letter-spacing: -0.02em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}

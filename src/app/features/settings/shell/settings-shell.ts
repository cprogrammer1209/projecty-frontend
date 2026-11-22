import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { SaveBarService } from '../../../core/ui/save-bar.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { PORTAL_PAGES, PROJECT_PAGES, SOON_MODULES } from './settings-nav';

interface PaletteEntry {
  label: string;
  hint: string;
  url: string;
  icon: string;
}

interface PageInfo {
  heading: [string, string] | null;
  width: string | undefined;
  topTitle: string;
}

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** True when the key press comes from a control the user is typing into (so "/" must stay a character). */
function isTyping(n: EventTarget | null): boolean {
  const el = n as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return (
    el.tagName === 'INPUT' &&
    !['radio', 'checkbox', 'button'].includes((el as HTMLInputElement).type)
  );
}

/**
 * The full-page settings shell (Linear style): navigation grouped module-wise, a command palette (Ctrl/Cmd+K or "/"),
 * the page column, and the global toasts and save bar. The styles are global, scoped under `.lset`.
 */
@Component({
  selector: 'py-settings-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './settings-shell.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class SettingsShell {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portal = inject(ActivePortalService);
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly saveBar = inject(SaveBarService);
  protected readonly toasts = inject(ToastService);

  protected readonly mod = MOD;
  protected readonly soon = SOON_MODULES;
  protected readonly drawer = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('pal');
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('palInput');

  protected readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });
  protected readonly userName = computed(() => this.auth.me()?.fullName ?? '');
  protected readonly portalPages = computed(() =>
    PORTAL_PAGES.filter((p) => !p.permission || this.portal.can(p.permission)),
  );
  protected readonly projectPages = computed(() =>
    PROJECT_PAGES.filter((p) => !p.permission || this.portal.can(p.permission)),
  );

  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map((): PageInfo => this.readPage()),
    ),
    { initialValue: { heading: null, width: undefined, topTitle: 'Settings' } },
  );

  private readonly allEntries = computed<PaletteEntry[]>(() => {
    const slug = this.slug();
    const base = `/p/${slug}/settings/`;
    return [
      ...this.portalPages().map((p) => ({
        label: p.label,
        hint: 'Portal',
        url: base + p.id,
        icon: p.icon,
      })),
      ...this.projectPages().map((p) => ({
        label: 'Projects › ' + p.label,
        hint: 'Projects',
        url: `${base}projects/${p.id}`,
        icon: p.icon,
      })),
      ...SOON_MODULES.map((m) => ({ label: m.name, hint: 'Soon', url: base + m.id, icon: m.id })),
      { label: 'Back to the app', hint: 'ProjectY', url: `/p/${slug}`, icon: 'back' },
    ];
  });
  protected readonly entries = computed(() => {
    const t = this.query().trim().toLowerCase();
    return this.allEntries().filter((e) => (e.label + ' ' + e.hint).toLowerCase().includes(t));
  });

  protected link(path: string): string[] {
    return ['/p', this.slug(), 'settings', ...path.split('/')];
  }

  private readPage(): PageInfo {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    const data = r.data as { heading?: unknown; width?: string; topTitle?: string };
    let heading: [string, string] | null = null;
    if (data.heading === 'module') {
      const m = SOON_MODULES.find((x) => x.id === r.paramMap.get('module'));
      heading = [m ? m.name : 'Page not found', ''];
    } else if (Array.isArray(data.heading)) {
      heading = [String(data.heading[0]), String(data.heading[1] ?? '')];
    }
    return { heading, width: data.width, topTitle: data.topTitle ?? heading?.[0] ?? 'Settings' };
  }

  protected openPalette(): void {
    const d = this.dialogRef().nativeElement;
    if (!d.open) d.showModal();
    this.query.set('');
    this.active.set(0);
    this.inputRef().nativeElement.value = '';
    this.inputRef().nativeElement.focus();
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onPaletteBackdrop(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) this.dialogRef().nativeElement.close();
  }

  protected onPaletteKey(event: KeyboardEvent): void {
    const n = this.entries().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!n) return;
      this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + n) % n);
      queueMicrotask(() =>
        this.dialogRef()
          .nativeElement.querySelector('li.act')
          ?.scrollIntoView({ block: 'nearest' }),
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const e = this.entries()[this.active()];
      if (e) this.go(e);
    }
  }

  protected go(entry: PaletteEntry): void {
    this.dialogRef().nativeElement.close();
    void this.router.navigateByUrl(entry.url);
  }

  protected onKey(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    const d = this.dialogRef().nativeElement;
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (d.open) d.close();
      else this.openPalette();
      return;
    }
    if (event.key === 'Escape' && this.drawer()) {
      this.drawer.set(false);
      return;
    }
    if (d.open || document.querySelector('.lset dialog[open], .lset [aria-modal="true"]')) return;
    if (event.key === '/' && !mod && !isTyping(event.target)) {
      event.preventDefault();
      this.openPalette();
    }
  }
}

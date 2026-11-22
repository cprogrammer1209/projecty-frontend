import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, Data, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';

/**
 * Work sections (M1). Those with a `route` are built; the rest are shown so the layout is complete, but disabled.
 */
const COMING_LATER: { icon: string; label: string; route?: string }[] = [
  { icon: 'user', label: 'My Work' },
  { icon: 'inbox', label: 'Inbox' },
  { icon: 'folder', label: 'Projects', route: 'projects' },
  { icon: 'layers', label: 'Portfolio' },
  { icon: 'chart', label: 'Reports' },
];

/** Signed-in layout for /p/{slug}: sidebar with the portal switcher (PTL-US-03), top bar, current page. */
@Component({
  selector: 'py-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './portal-shell.html',
  styleUrl: './portal-shell.scss',
  host: { '(document:click)': 'closeMenus()' },
})
export class PortalShell {
  protected readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly comingLater = COMING_LATER;
  protected readonly initials = initials;
  protected readonly switcherOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly sidebarOpen = signal(false);

  /** The deepest active route's data: its breadcrumb and whether the page wants the full width. */
  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      tap(() => this.sidebarOpen.set(false)),
      map(() => leafDataOf(this.router.routerState.snapshot.root)),
    ),
    { initialValue: leafDataOf(this.router.routerState.snapshot.root) },
  );
  protected readonly crumb = computed(() => (this.routeData()['crumb'] as string | undefined) ?? '');
  /** Routes with `data: { fluid: true }` (tables and dashboards) skip the centred, width-limited column. */
  protected readonly fluid = computed(() => !!this.routeData()['fluid']);

  protected toggleSwitcher(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.set(false);
    this.switcherOpen.update((open) => !open);
  }

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.switcherOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  protected closeMenus(): void {
    this.switcherOpen.set(false);
    this.userMenuOpen.set(false);
  }

  protected switchTo(slug: string): void {
    this.closeMenus();
    this.router.navigate(['/p', slug]);
  }

  protected signOut(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/sign-in'));
  }
}

function leafDataOf(route: ActivatedRouteSnapshot): Data {
  let current = route;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return current.data;
}

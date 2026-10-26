import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/ui/icon/icon';
import { initials } from '../auth/text';

/** Sections that arrive with the Work service (M1); shown so the layout is complete, but disabled. */
const COMING_LATER = [
  { icon: 'user', label: 'My Work' },
  { icon: 'inbox', label: 'Inbox' },
  { icon: 'folder', label: 'Projects' },
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

  protected readonly crumb = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      tap(() => this.sidebarOpen.set(false)),
      map(() => crumbOf(this.router.routerState.snapshot.root)),
    ),
    { initialValue: crumbOf(this.router.routerState.snapshot.root) },
  );

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

function crumbOf(route: ActivatedRouteSnapshot): string {
  let current = route;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return (current.data['crumb'] as string | undefined) ?? '';
}

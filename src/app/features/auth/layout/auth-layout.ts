import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { ThemeService } from '../../../core/theme/theme.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Logo } from '../../../shared/ui/logo/logo';
import { FlowShowcase } from '../showcase/flow-showcase';
import { PortalPreview } from '../showcase/portal-preview';

export type Showcase = 'fork' | 'preview';

/** Two-pane shell for every signed-out screen: form on the left, showcase on the right. */
@Component({
  selector: 'py-auth-layout',
  imports: [RouterOutlet, Logo, Icon, FlowShowcase, PortalPreview],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly showcase = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => showcaseOf(this.router.routerState.snapshot.root)),
    ),
    { initialValue: showcaseOf(this.router.routerState.snapshot.root) },
  );

  protected readonly year = new Date().getFullYear();
}

function showcaseOf(route: ActivatedRouteSnapshot): Showcase {
  let current = route;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return (current.data['showcase'] as Showcase | undefined) ?? 'fork';
}

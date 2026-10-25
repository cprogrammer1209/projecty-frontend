import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { initials } from '../text';

const PROFILE_LABELS: Record<string, string> = {
  PORTAL_OWNER: 'Portal owner',
};

@Component({
  selector: 'py-portal-picker',
  imports: [RouterLink, Icon],
  templateUrl: './portal-picker.html',
  styleUrl: './portal-picker.scss',
})
export class PortalPicker {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly me = this.auth.me;
  protected readonly initials = initials;

  protected profileLabel(profile: string): string {
    return PROFILE_LABELS[profile] ?? profile;
  }

  protected open(slug: string): void {
    this.router.navigateByUrl(`/p/${slug}`);
  }

  protected signOut(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/sign-in'));
  }
}

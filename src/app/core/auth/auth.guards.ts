import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { ActivePortalService } from '../portal/active-portal.service';

import { AuthService } from './auth.service';

/** Signed-in users only; everyone else goes to sign in. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || inject(Router).parseUrl('/sign-in');
};

/** Guests only; signed-in users go to where they belong. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || inject(Router).parseUrl(auth.landingUrl());
};

/** /p/{slug}: makes that portal active, or shows "portal not found" if the user isn't in it. */
export const portalGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const slug = route.paramMap.get('slug') ?? '';
  return inject(ActivePortalService)
    .activate(slug)
    .pipe(map((ok) => ok || router.parseUrl('/portal-not-found')));
};

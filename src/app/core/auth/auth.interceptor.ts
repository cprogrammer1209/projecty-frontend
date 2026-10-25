import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { ActivePortalService } from '../portal/active-portal.service';
import { AuthService } from './auth.service';

const API_PREFIX = '/api/';
const AUTH_PREFIX = '/api/auth/';
const PORTAL_HEADER = 'X-Portal-Id';

/**
 * Adds the access token, and the active portal (X-Portal-Id) when there is one, to API calls. On a 401 it
 * refreshes once and retries; if the refresh fails the session is over and the user goes back to sign in.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_PREFIX) || req.url.startsWith(AUTH_PREFIX)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const portalId = inject(ActivePortalService).portalId();
  if (portalId) {
    req = req.clone({ setHeaders: { [PORTAL_HEADER]: portalId } });
  }

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError((refreshErr: unknown) => {
          router.navigateByUrl('/sign-in');
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

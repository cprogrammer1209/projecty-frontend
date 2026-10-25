import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { authGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  function signIn(): void {
    TestBed.inject(AuthService).refresh().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/refresh')
      .flush({ success: true, data: { accessToken: 't', tokenType: 'Bearer', expiresIn: 900 } });
  }

  it('authGuard sends guests to sign in', () => {
    expect((run(authGuard) as UrlTree).toString()).toBe('/sign-in');
  });

  it('authGuard lets signed-in users through', () => {
    signIn();
    expect(run(authGuard)).toBeTrue();
  });

  it('guestGuard lets guests through', () => {
    expect(run(guestGuard)).toBeTrue();
  });

  it('guestGuard forwards signed-in users to their landing page', () => {
    signIn();
    expect((run(guestGuard) as UrlTree).toString()).toBe('/portals/new');
  });
});

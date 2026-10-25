import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shares one refresh request between concurrent callers', () => {
    const tokens: string[] = [];
    auth.refresh().subscribe((t) => tokens.push(t));
    auth.refresh().subscribe((t) => tokens.push(t));

    http.expectOne('/api/auth/refresh').flush({ success: true, data: { accessToken: 'abc', tokenType: 'Bearer', expiresIn: 900 } });

    expect(tokens).toEqual(['abc', 'abc']);
    expect(auth.accessToken()).toBe('abc');
  });

  it('starts a new refresh once the previous one finished', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush({ success: true, data: { accessToken: 'a', tokenType: 'Bearer', expiresIn: 900 } });
    auth.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush({ success: true, data: { accessToken: 'b', tokenType: 'Bearer', expiresIn: 900 } });
    expect(auth.accessToken()).toBe('b');
  });

  it('clears the session when refresh fails', () => {
    auth.refresh().subscribe({ error: () => {} });
    http.expectOne('/api/auth/refresh').flush(
      { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('restoreSession resolves for guests without a cookie', async () => {
    const done = auth.restoreSession();
    http.expectOne('/api/auth/refresh').flush(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No session' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expectAsync(done).toBeResolved();
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('routes by portal count', () => {
    const portal = (slug: string) => ({ id: slug, name: slug, slug, profile: 'PORTAL_OWNER' });
    expect(auth.landingUrl([])).toBe('/portals/new');
    expect(auth.landingUrl([portal('acme')])).toBe('/p/acme');
    expect(auth.landingUrl([portal('a'), portal('b')])).toBe('/portals');
  });
});

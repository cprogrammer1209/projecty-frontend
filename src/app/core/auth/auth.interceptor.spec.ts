import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const tokenBody = (token: string) => ({ success: true, data: { accessToken: token, tokenType: 'Bearer', expiresIn: 900 } });
const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    auth.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush(tokenBody('old'));
  });

  afterEach(() => http.verify());

  it('adds the bearer token to API calls but not to auth endpoints', () => {
    client.get('/api/me').subscribe();
    client.post('/api/auth/logout', null).subscribe();

    expect(http.expectOne('/api/me').request.headers.get('Authorization')).toBe('Bearer old');
    expect(http.expectOne('/api/auth/logout').request.headers.has('Authorization')).toBeFalse();
  });

  it('refreshes once on 401 and retries with the new token', () => {
    let body: unknown;
    client.get('/api/me').subscribe((b) => (body = b));

    http.expectOne('/api/me').flush(null, unauthorized);
    http.expectOne('/api/auth/refresh').flush(tokenBody('new'));
    const retry = http.expectOne('/api/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush({ success: true, data: 'ok' });

    expect(body).toEqual({ success: true, data: 'ok' });
  });

  it('gives up after one retry and sends the user to sign in when refresh fails', () => {
    let failed = false;
    client.get('/api/me').subscribe({ error: () => (failed = true) });

    http.expectOne('/api/me').flush(null, unauthorized);
    http.expectOne('/api/auth/refresh').flush(null, unauthorized);

    expect(failed).toBeTrue();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/sign-in');
  });

  it('does not loop when the retried call is also 401', () => {
    let failed = false;
    client.get('/api/me').subscribe({ error: () => (failed = true) });

    http.expectOne('/api/me').flush(null, unauthorized);
    http.expectOne('/api/auth/refresh').flush(tokenBody('new'));
    http.expectOne('/api/me').flush(null, unauthorized);

    expect(failed).toBeTrue();
  });
});

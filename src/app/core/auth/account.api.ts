import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';

/** Account endpoints that don't need a session: sign up, email verification, password reset. */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  signup(fullName: string, email: string, password: string): Observable<void> {
    return this.post('/api/auth/signup', { fullName, email, password });
  }

  verifyEmail(token: string): Observable<void> {
    return this.post('/api/auth/verify-email', { token });
  }

  resendVerification(email: string): Observable<void> {
    return this.post('/api/auth/resend-verification', { email });
  }

  forgotPassword(email: string): Observable<void> {
    return this.post('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.post('/api/auth/reset-password', { token, newPassword });
  }

  private post(url: string, body: object): Observable<void> {
    return this.http.post<AppResponse<void>>(url, body).pipe(unwrap());
  }
}

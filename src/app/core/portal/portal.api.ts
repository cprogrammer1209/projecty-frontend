import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';
import { PortalMembership } from '../auth/auth.models';

export interface SlugAvailability {
  available: boolean;
  reason: string | null;
  suggestions: string[];
}

@Injectable({ providedIn: 'root' })
export class PortalApi {
  private readonly http = inject(HttpClient);

  create(name: string, slug: string): Observable<PortalMembership> {
    return this.http.post<AppResponse<PortalMembership>>('/api/portals', { name, slug }).pipe(unwrap());
  }

  slugAvailability(slug: string): Observable<SlugAvailability> {
    return this.http
      .get<AppResponse<SlugAvailability>>('/api/portals/slug-availability', { params: { slug } })
      .pipe(unwrap());
  }
}

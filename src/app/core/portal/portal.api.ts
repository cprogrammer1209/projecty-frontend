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

export type WeekStart = 'MONDAY' | 'SUNDAY' | 'SATURDAY';

/** The portal of the current request (X-Portal-Id) and its settings. */
export interface CurrentPortal {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  timeZone: string;
  dateFormat: string;
  currency: string;
  weekStart: WeekStart;
}

export interface PortalSettings {
  timeZone: string;
  dateFormat: string;
  currency: string;
  weekStart: WeekStart;
}

/** Same list as the backend's PortalConstants.ALLOWED_DATE_FORMATS. */
export const DATE_FORMATS = ['MMM d, yyyy', 'd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];

@Injectable({ providedIn: 'root' })
export class PortalApi {
  private readonly http = inject(HttpClient);

  /** The creator's browser time zone becomes the portal's default. */
  create(name: string, slug: string): Observable<PortalMembership> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return this.http
      .post<AppResponse<PortalMembership>>('/api/portals', { name, slug, timeZone })
      .pipe(unwrap());
  }

  /** Needs an active portal (X-Portal-Id is added by the interceptor). */
  current(): Observable<CurrentPortal> {
    return this.http.get<AppResponse<CurrentPortal>>('/api/portal').pipe(unwrap());
  }

  updateSettings(settings: PortalSettings): Observable<CurrentPortal> {
    return this.http.patch<AppResponse<CurrentPortal>>('/api/portal/settings', settings).pipe(unwrap());
  }

  slugAvailability(slug: string): Observable<SlugAvailability> {
    return this.http
      .get<AppResponse<SlugAvailability>>('/api/portals/slug-availability', { params: { slug } })
      .pipe(unwrap());
  }
}

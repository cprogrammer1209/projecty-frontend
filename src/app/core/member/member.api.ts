import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { unwrap } from '../api/api-error';
import { AppResponse } from '../api/api.types';

/** Permission names from the backend's PermissionConstants. */
export type Permission = 'PORTAL_SETTINGS_MANAGE' | 'USERS_VIEW' | 'USERS_MANAGE';

export interface MyMembership {
  profileId: string;
  profile: string;
  profileName: string;
  permissions: Permission[];
  owner: boolean;
}

export interface Member {
  userId: string;
  fullName: string;
  email: string;
  profileId: string;
  profile: string;
  profileName: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  owner: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
}

export interface Profile {
  id: string;
  profile: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Invitation {
  id: string;
  email: string;
  profileId: string;
  profileName: string;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationPreview {
  portalName: string;
  email: string;
  profileName: string;
  invitedByName: string | null;
  valid: boolean;
  accountExists: boolean;
}

export interface AcceptedInvitation {
  portalId: string;
  portalSlug: string;
}

/** The member module: people in the active portal (X-Portal-Id), profiles and invitations. */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly http = inject(HttpClient);

  me(): Observable<MyMembership> {
    return this.http.get<AppResponse<MyMembership>>('/api/portal/me').pipe(unwrap());
  }

  members(): Observable<Member[]> {
    return this.http.get<AppResponse<Member[]>>('/api/portal/members').pipe(unwrap());
  }

  profiles(): Observable<Profile[]> {
    return this.http.get<AppResponse<Profile[]>>('/api/portal/profiles').pipe(unwrap());
  }

  changeProfile(userId: string, profileId: string): Observable<Member> {
    return this.http.patch<AppResponse<Member>>(`/api/portal/members/${userId}`, { profileId }).pipe(unwrap());
  }

  deactivate(userId: string): Observable<Member> {
    return this.http.post<AppResponse<Member>>(`/api/portal/members/${userId}/deactivate`, null).pipe(unwrap());
  }

  reactivate(userId: string): Observable<Member> {
    return this.http.post<AppResponse<Member>>(`/api/portal/members/${userId}/reactivate`, null).pipe(unwrap());
  }

  invitations(): Observable<Invitation[]> {
    return this.http.get<AppResponse<Invitation[]>>('/api/portal/invitations').pipe(unwrap());
  }

  invite(email: string, profileId: string): Observable<Invitation> {
    return this.http.post<AppResponse<Invitation>>('/api/portal/invitations', { email, profileId }).pipe(unwrap());
  }

  revoke(invitationId: string): Observable<void> {
    return this.http.delete<AppResponse<void>>(`/api/portal/invitations/${invitationId}`).pipe(unwrap());
  }

  preview(token: string): Observable<InvitationPreview> {
    return this.http
      .get<AppResponse<InvitationPreview>>(`/api/auth/invitations/${encodeURIComponent(token)}`)
      .pipe(unwrap());
  }

  acceptAsNewUser(token: string, fullName: string, password: string): Observable<AcceptedInvitation> {
    return this.http
      .post<AppResponse<AcceptedInvitation>>('/api/auth/invitations/accept-new', { token, fullName, password })
      .pipe(unwrap());
  }

  accept(token: string): Observable<AcceptedInvitation> {
    return this.http.post<AppResponse<AcceptedInvitation>>('/api/invitations/accept', { token }).pipe(unwrap());
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';

import { ActivePortalService } from '../portal/active-portal.service';
import { Member, MemberApi } from './member.api';

const UNKNOWN_NAME = 'Unknown member';

/**
 * The people of the active portal, for showing names next to the user ids other services return (Work stores
 * only ids). Loaded once per portal from Platform's members list. Without USERS_VIEW (e.g. a Client) it stays
 * empty and names show as "Unknown member".
 */
@Injectable({ providedIn: 'root' })
export class PortalPeople {
  private readonly memberApi = inject(MemberApi);
  private readonly active = inject(ActivePortalService);

  private readonly all = signal<Member[]>([]);
  private loadedFor: string | null = null;

  readonly members = this.all.asReadonly();
  /** People who can own or join a project. */
  readonly activeMembers = computed(() => this.all().filter((m) => m.status === 'ACTIVE'));

  /** Safe to call from every page; it only loads when the active portal changed. */
  load(): void {
    const portalId = this.active.portalId();
    if (!portalId || this.loadedFor === portalId) {
      return;
    }
    this.loadedFor = portalId;
    this.all.set([]);
    if (!this.active.can('USERS_VIEW')) {
      return;
    }
    this.memberApi.members().subscribe({
      next: (members) => this.all.set(members),
      error: () => (this.loadedFor = null),
    });
  }

  nameOf(userId: string | null | undefined): string {
    return this.all().find((m) => m.userId === userId)?.fullName ?? UNKNOWN_NAME;
  }
}

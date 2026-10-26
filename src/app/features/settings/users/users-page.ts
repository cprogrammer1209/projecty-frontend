import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { Invitation, Member, MemberApi, Profile } from '../../../core/member/member.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { PyDatePipe } from '../../../shared/pipes/py-date.pipe';
import { Field } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { initials } from '../../auth/text';

type StatusFilter = 'ALL' | 'ACTIVE' | 'DEACTIVATED';

/**
 * Settings → Users (USR-US-01, 03, 04, 05). Everyone with USERS_VIEW sees the list; the actions need
 * USERS_MANAGE. The server enforces both, and the owner/last-Admin rules.
 */
@Component({
  selector: 'py-users-page',
  imports: [ReactiveFormsModule, PyDatePipe, Field, Icon],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage implements OnInit {
  private readonly memberApi = inject(MemberApi);
  private readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);

  protected readonly canManage = this.active.can('USERS_MANAGE');
  protected readonly members = signal<Member[] | null>(null);
  protected readonly profiles = signal<Profile[]>([]);
  protected readonly invitations = signal<Invitation[]>([]);
  protected readonly query = signal('');
  protected readonly status = signal<StatusFilter>('ALL');
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busyUser = signal<string | null>(null);
  protected readonly confirmUser = signal<Member | null>(null);
  protected readonly inviteOpen = signal(false);
  protected readonly inviteBusy = signal(false);
  protected readonly inviteError = signal<string | null>(null);
  protected readonly initials = initials;

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.members() ?? []).filter(
      (m) =>
        (this.status() === 'ALL' || m.status === this.status()) &&
        (!q || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  });
  protected readonly activeCount = computed(() => (this.members() ?? []).filter((m) => m.status === 'ACTIVE').length);

  protected readonly inviteForm = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    profileId: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  protected isSelf(member: Member): boolean {
    return member.userId === this.auth.me()?.id;
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected changeProfile(member: Member, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.run(member, this.memberApi.changeProfile(member.userId, select.value), () => (select.value = member.profileId));
  }

  protected toggleActive(member: Member): void {
    this.confirmUser.set(null);
    const call = member.status === 'ACTIVE' ? this.memberApi.deactivate(member.userId) : this.memberApi.reactivate(member.userId);
    this.run(member, call);
  }

  protected openInvite(): void {
    const employee = this.profiles().find((p) => p.profile === 'EMPLOYEE') ?? this.profiles()[0];
    this.inviteForm.reset({ email: '', profileId: employee?.id ?? '' });
    this.inviteError.set(null);
    this.inviteOpen.set(true);
  }

  protected sendInvite(): void {
    this.inviteForm.markAllAsTouched();
    if (this.inviteForm.invalid) {
      return;
    }
    const { email, profileId } = this.inviteForm.getRawValue();
    this.inviteBusy.set(true);
    this.memberApi.invite(email.trim(), profileId).subscribe({
      next: (invitation) => {
        this.inviteBusy.set(false);
        this.inviteOpen.set(false);
        this.notice.set(`Invitation sent to ${invitation.email}.`);
        this.loadInvitations();
      },
      error: (err: ApiError) => {
        this.inviteBusy.set(false);
        this.inviteError.set(err.details['email'] ? String(err.details['email']) : err.message);
      },
    });
  }

  protected resend(invitation: Invitation): void {
    this.memberApi.invite(invitation.email, invitation.profileId).subscribe({
      next: () => {
        this.notice.set(`A new invitation was sent to ${invitation.email}.`);
        this.loadInvitations();
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  protected revoke(invitation: Invitation): void {
    this.memberApi.revoke(invitation.id).subscribe({
      next: () => {
        this.notice.set(`Invitation to ${invitation.email} withdrawn.`);
        this.loadInvitations();
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  private run(member: Member, call: ReturnType<MemberApi['deactivate']>, onError?: () => void): void {
    this.error.set(null);
    this.notice.set(null);
    this.busyUser.set(member.userId);
    call.subscribe({
      next: (updated) => {
        this.busyUser.set(null);
        this.members.update((list) => (list ?? []).map((m) => (m.userId === updated.userId ? updated : m)));
      },
      error: (err: ApiError) => {
        this.busyUser.set(null);
        this.error.set(err.message);
        onError?.();
      },
    });
  }

  private load(): void {
    this.memberApi.members().subscribe({
      next: (members) => this.members.set(members),
      error: (err: ApiError) => {
        this.members.set([]);
        this.error.set(err.message);
      },
    });
    this.memberApi.profiles().subscribe({ next: (profiles) => this.profiles.set(profiles) });
    this.loadInvitations();
  }

  private loadInvitations(): void {
    if (this.canManage) {
      this.memberApi.invitations().subscribe({ next: (list) => this.invitations.set(list) });
    }
  }
}

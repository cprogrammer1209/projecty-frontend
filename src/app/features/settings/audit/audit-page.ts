import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiError } from '../../../core/api/api.types';
import { AuditApi, AuditEvent, Paged } from '../../../core/audit/audit.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { PyDatePipe } from '../../../shared/pipes/py-date.pipe';
import { Icon } from '../../../shared/ui/icon/icon';
import { initials } from '../../auth/text';

/** The actions a portal's log can hold, with the label shown for each (the backend's AuditEventConstants). */
const ACTIONS: { value: string; label: string }[] = [
  { value: 'PORTAL_CREATED', label: 'Portal created' },
  { value: 'PORTAL_SETTINGS_CHANGED', label: 'Portal settings changed' },
  { value: 'USER_INVITED', label: 'User invited' },
  { value: 'INVITATION_REVOKED', label: 'Invitation withdrawn' },
  { value: 'INVITATION_ACCEPTED', label: 'Invitation accepted' },
  { value: 'USER_PROFILE_CHANGED', label: 'Profile changed' },
  { value: 'USER_DEACTIVATED', label: 'User deactivated' },
  { value: 'USER_REACTIVATED', label: 'User reactivated' },
  { value: 'IMPERSONATION_STARTED', label: 'Support session started' },
  { value: 'IMPERSONATION_ENDED', label: 'Support session ended' },
];
const ACTION_LABELS = new Map(ACTIONS.map((a) => [a.value, a.label]));
const PAGE_SIZES = [10, 25, 50];

/** Settings → Audit log (SEC-US-05). Needs AUDIT_VIEW (Admins); the server enforces it. Read-only by design. */
@Component({
  selector: 'py-audit-page',
  imports: [PyDatePipe, Icon],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage implements OnInit {
  private readonly auditApi = inject(AuditApi);
  protected readonly active = inject(ActivePortalService);

  protected readonly actions = ACTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly data = signal<Paged<AuditEvent> | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly action = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZES[1]);
  protected readonly initials = initials;
  /** Only the newest request may fill the table, so a slow earlier one can't overwrite it. */
  private requestId = 0;

  ngOnInit(): void {
    this.load();
  }

  protected actionLabel(value: string): string {
    return ACTION_LABELS.get(value) ?? value;
  }

  protected dateTimePattern(): string {
    return `${this.active.portal()?.dateFormat ?? 'MMM d, yyyy'}, h:mm a`;
  }

  protected rangeLabel(d: Paged<AuditEvent>): string {
    if (!d.totalItems) {
      return '0 events';
    }
    return `${d.page * d.size + 1}–${Math.min((d.page + 1) * d.size, d.totalItems)} of ${d.totalItems}`;
  }

  protected onAction(event: Event): void {
    this.action.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.load();
  }

  protected onSize(event: Event): void {
    this.size.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(0);
    this.load();
  }

  protected go(delta: number): void {
    this.page.update((p) => p + delta);
    this.load();
  }

  private load(): void {
    const id = ++this.requestId;
    this.data.set(null);
    this.error.set(null);
    this.auditApi.events({ action: this.action(), page: this.page(), size: this.size() }).subscribe({
      next: (data) => id === this.requestId && this.data.set(data),
      error: (err: ApiError) => {
        if (id === this.requestId) {
          this.error.set(err.message);
          this.data.set({ items: [], page: 0, size: this.size(), totalItems: 0, totalPages: 1 });
        }
      },
    });
  }
}

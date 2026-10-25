import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ActivePortalService } from '../../core/portal/active-portal.service';
import { PyDatePipe, hourIn } from '../../shared/pipes/py-date.pipe';
import { Icon } from '../../shared/ui/icon/icon';

const WEEK_START_LABELS: Record<string, string> = { MONDAY: 'Monday', SUNDAY: 'Sunday', SATURDAY: 'Saturday' };

/**
 * Portal home (layout from projecty-home.html). Tasks, projects, agenda and activity come with the Work
 * service in M1, so those panels show what will appear there.
 */
@Component({
  selector: 'py-home',
  imports: [RouterLink, PyDatePipe, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly auth = inject(AuthService);
  protected readonly active = inject(ActivePortalService);
  protected readonly now = new Date();

  protected readonly greeting = computed(() => {
    const hour = hourIn(this.now, this.active.timeZone());
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = this.auth.me()?.fullName.split(/\s+/)[0];
    return firstName ? `${part}, ${firstName}` : part;
  });

  protected readonly stats = [
    { icon: 'check', label: 'My open tasks' },
    { icon: 'chart', label: 'Due this week' },
    { icon: 'folder', label: 'Projects in progress' },
    { icon: 'layers', label: 'Completed this month' },
  ];

  protected weekStartLabel(value: string | undefined): string {
    return value ? (WEEK_START_LABELS[value] ?? value) : '';
  }
}

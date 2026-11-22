import { formatDate } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

import { ActivePortalService } from '../../core/portal/active-portal.service';

/**
 * Shows a plain date (`2026-12-01`, no time) in the portal's date format. Unlike `pyDate` it does not convert
 * between time zones: a project start date is a calendar day, and must not move to the day before for someone
 * west of UTC. Impure, so it follows settings changes.
 */
@Pipe({ name: 'pyDay', pure: false })
export class PyDayPipe implements PipeTransform {
  private readonly portal = inject(ActivePortalService);
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | null | undefined, pattern?: string): string {
    if (!value) {
      return '';
    }
    const format = pattern ?? this.portal.portal()?.dateFormat ?? 'MMM d, yyyy';
    return formatDate(`${value}T00:00:00Z`, format, this.locale, '+0000');
  }
}

import { formatDate } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

import { ActivePortalService } from '../../core/portal/active-portal.service';

/**
 * Shows a UTC instant in the user's time zone (else the portal's) and the portal's date format (PTL-BR-05).
 * `pattern` overrides the portal format, e.g. `'EEEE'` or `'h:mm a'`. Impure, so it follows settings changes.
 */
@Pipe({ name: 'pyDate', pure: false })
export class PyDatePipe implements PipeTransform {
  private readonly portal = inject(ActivePortalService);
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | Date | null | undefined, pattern?: string): string {
    if (value == null) {
      return '';
    }
    const date = new Date(value);
    const format = pattern ?? this.portal.portal()?.dateFormat ?? 'MMM d, yyyy';
    return formatDate(date, format, this.locale, zoneOffset(date, this.portal.timeZone()));
  }
}

/**
 * Angular's formatDate takes an offset like "+0530", not an IANA zone, so work out the zone's offset at
 * that instant (it changes with daylight saving).
 */
export function zoneOffset(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  return match ? `${match[1]}${match[2]}${match[3]}` : '+0000';
}

/** The hour (0–23) of an instant in a time zone, for "Good morning". */
export function hourIn(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date));
}

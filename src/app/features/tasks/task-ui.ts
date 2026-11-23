import { CustomFieldOption } from '../../core/customfield/custom-field.api';
import { WeekStart } from '../../core/portal/portal.api';
import { StatusType, Task, TaskPriority } from '../../core/task/task.api';

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'NONE', label: 'None' },
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HIGH', label: 'High' },
  { id: 'CRITICAL', label: 'Critical' },
];

export const priorityLabel = (p: TaskPriority): string => PRIORITIES.find((x) => x.id === p)?.label ?? p;

/** A choice for a PropertyList picklist (the list works with layout-field options). */
export const option = (id: string, label: string, sortOrder: number): CustomFieldOption => ({
  id,
  label,
  color: null,
  sortOrder,
  defaultOption: false,
  active: true,
});

/** Today as yyyy-MM-dd in the browser's time zone, to compare with plain due dates. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as yyyy-MM-dd in the given time zone (the user's own, else the portal's). */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Adds days to a plain yyyy-MM-dd date (calendar arithmetic, no time zone involved). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEK_START_DAY: Record<WeekStart, number> = { SUNDAY: 0, MONDAY: 1, SATURDAY: 6 };

/** The last day (yyyy-MM-dd) of the calendar week that contains `today`, given the portal's first day of the week. */
export function weekEnd(today: string, weekStart: WeekStart): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sinceStart = (dow - (WEEK_START_DAY[weekStart] ?? 1) + 7) % 7;
  return addDays(today, 6 - sinceStart);
}

export type DueBucketId = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'earlier';

export const DUE_BUCKETS: { id: DueBucketId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
  { id: 'none', label: 'No due date' },
  { id: 'earlier', label: 'Earlier (closed)' },
];

/** Where a task falls in My Tasks: past-due open ones are Overdue, closed past-due ones go under Earlier (closed). */
export function dueBucket(t: { dueDate: string | null; statusType: StatusType }, today: string, weekEndDay: string): DueBucketId {
  if (!t.dueDate) return 'none';
  if (t.dueDate < today) return t.statusType === 'CLOSED' ? 'earlier' : 'overdue';
  if (t.dueDate === today) return 'today';
  return t.dueDate <= weekEndDay ? 'week' : 'later';
}

/** A task is overdue when it is still open and its due date has passed. */
export const isOverdue = (t: Pick<Task, 'dueDate' | 'statusType'>, now = today()): boolean =>
  !!t.dueDate && t.statusType === 'OPEN' && t.dueDate < now;

/** The text of an error for one property: the server's note for that key (or the first note it sent), else its general message. */
export function propertyError(err: unknown, key: string): Error {
  const e = err as { message?: string; details?: Record<string, unknown> };
  const own = e.details?.[key];
  const any = Object.values(e.details ?? {}).find((v) => typeof v === 'string');
  const detail = typeof own === 'string' ? own : any;
  return new Error(typeof detail === 'string' ? detail : (e.message ?? 'Could not save.'));
}

import { LayoutStatus } from '../../../core/customfield/layout.api';
import { TaskPriority } from '../../../core/task/task.api';
import { DUE_BUCKETS, dueBucket } from '../task-ui';
import { PRIO_LABEL, PRIO_ORDER, TvData, TvFilter, TvGroup, TvGroupId, TvTask } from './tv-model';

export const statusKey = (name: string): string => name.toLowerCase();

/** The statuses a task can move to: its own layout's. */
export const statusesOf = (d: TvData, t: TvTask): LayoutStatus[] => d.layouts[t.layoutId] ?? d.byProject[t.projectId]?.statuses ?? [];

/** Statuses by name across the projects on screen (one column per name); open ones first when several projects mix. */
export function statusGroups(d: TvData): { id: string; label: string; status: LayoutStatus }[] {
  const seen = new Map<string, { id: string; label: string; status: LayoutStatus }>();
  const add = (s: LayoutStatus): void => {
    if (!seen.has(statusKey(s.name))) seen.set(statusKey(s.name), { id: statusKey(s.name), label: s.name, status: s });
  };
  d.projects.forEach((p) => p.statuses.forEach(add));
  // A task can sit in a status its project no longer lists (another layout): it still gets a column.
  d.tasks.forEach((t) => statusesOf(d, t).filter((s) => s.id === t.statusId).forEach(add));
  const all = [...seen.values()];
  return d.projects.length === 1 ? all : [...all.filter((g) => g.status.statusType !== 'CLOSED'), ...all.filter((g) => g.status.statusType === 'CLOSED')];
}

export const isFiltered = (f: TvFilter): boolean => !!(f.q.trim() || f.status.length || f.owner.length || f.priority.length || f.project.length || f.tag.length);

export interface VisibleOptions {
  showArchived: boolean;
  showSub: boolean;
  showClosed: boolean;
  mine: boolean;
}

export function visibleTasks(d: TvData, f: TvFilter, o: VisibleOptions): TvTask[] {
  const q = f.q.trim().toLowerCase();
  const archived = new Set(d.lists.filter((l) => l.archived).map((l) => l.id));
  const filtering = isFiltered(f);
  return d.tasks.filter((t) => {
    if (!o.showArchived && archived.has(t.listId)) return false;
    if (o.mine && !o.showClosed && t.statusType === 'CLOSED') return false;
    if (!(o.showSub || filtering) && t.parentId) return false;
    if (f.status.length && !f.status.includes(statusKey(t.statusName))) return false;
    if (f.priority.length && !f.priority.includes(t.priority)) return false;
    if (f.owner.length && !(t.ownerIds.length ? t.ownerIds.some((x) => f.owner.includes(x)) : f.owner.includes('none'))) return false;
    if (f.project.length && !f.project.includes(t.projectId)) return false;
    if (f.tag.length && !t.tags.some((x) => f.tag.includes(x))) return false;
    if (q && !(t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q)))) return false;
    return true;
  });
}

export interface GroupOptions {
  portal: boolean;
  showArchived: boolean;
  filtered: boolean;
  /** The board keeps every priority as a column, so a card can be dropped on an empty one. */
  board: boolean;
  people: { userId: string; fullName: string }[];
}

/** The groups of the visible tasks by `key`. Status and list groups keep their empty ones (unless filtering or in the portal). */
export function buildGroups(d: TvData, tasks: TvTask[], key: TvGroupId, o: GroupOptions): TvGroup[] {
  const mk = (id: string, label: string, extra: Partial<TvGroup> = {}): TvGroup => ({ id, label, items: [], ...extra });
  let gs: TvGroup[];
  if (key === 'status') gs = statusGroups(d).map((g) => mk(g.id, g.label, { status: g.status }));
  else if (key === 'priority') gs = PRIO_ORDER.map((p) => mk(p, PRIO_LABEL[p], { prio: p }));
  else if (key === 'owner') gs = [...o.people.map((p) => mk(p.userId, p.fullName, { ownerId: p.userId })), mk('none', 'Unassigned', { ownerId: 'none' })];
  else if (key === 'list') gs = o.portal ? [] : d.lists.filter((l) => o.showArchived || !l.archived).map((l) => mk(l.id, l.name, { list: l }));
  else if (key === 'due') gs = DUE_BUCKETS.map((b) => mk(b.id, b.label));
  else gs = [mk('all', 'All tasks')];
  const idOf = (t: TvTask): string =>
    key === 'status' ? statusKey(t.statusName)
    : key === 'priority' ? t.priority
    : key === 'owner' ? (t.ownerIds[0] ?? 'none')
    : key === 'list' ? (o.portal ? `${t.projectId}:${t.listId}` : t.listId)
    : key === 'due' ? dueBucket(t, d.today, d.weekEnd)
    : 'all';
  for (const t of tasks) {
    const id = idOf(t);
    let g = gs.find((x) => x.id === id);
    if (!g) {
      g = mk(id, key === 'list' ? `${t.projectName} / ${t.listName}` : key === 'owner' ? 'Former member' : id, key === 'owner' ? { ownerId: id } : {});
      gs.push(g);
    }
    g.items.push(t);
  }
  if (key === 'list' && o.portal) gs.sort((a, b) => a.label.localeCompare(b.label));
  const keepEmpty = ((key === 'status' || key === 'list') && !o.filtered && !o.portal) || (o.board && !o.filtered && key === 'priority');
  return keepEmpty ? gs : gs.filter((g) => g.items.length);
}


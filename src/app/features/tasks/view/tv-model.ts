import { LayoutStatus } from '../../../core/customfield/layout.api';
import { Task, TaskList, TaskPriority } from '../../../core/task/task.api';

export type TvView = 'list' | 'board';
export type TvGroupId = 'status' | 'list' | 'owner' | 'priority' | 'due' | 'none';

export const TV_GROUPS: { id: TvGroupId; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'list', label: 'Task list' },
  { id: 'owner', label: 'Owner' },
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'none', label: 'No grouping' },
];

export const PRIO_ORDER: TaskPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
export const PRIO_LABEL: Record<TaskPriority, string> = { NONE: 'No priority', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };

/** A task row as the view shows it: the task plus its project's name. */
export interface TvTask extends Task {
  projectName: string;
}

export interface TvProject {
  id: string;
  key: string;
  name: string;
  /** May this person create tasks here (TASKS_CREATE and a project member, or an Admin)? */
  canCreate: boolean;
  /** The statuses of the project's task layout (new tasks use them). */
  statuses: LayoutStatus[];
}

/** What a screen hands the view after loading. */
export interface TvLoaded {
  tasks: TvTask[];
  projects: TvProject[];
  lists: TaskList[];
  /** Statuses by task layout id (a task's own layout decides its statuses). */
  layouts: Record<string, LayoutStatus[]>;
}

export interface TvData extends TvLoaded {
  byProject: Record<string, TvProject>;
  today: string;
  weekEnd: string;
}

export interface TvFilter {
  q: string;
  status: string[];
  owner: string[];
  priority: string[];
  project: string[];
  tag: string[];
}
export type TvFilterKey = 'status' | 'owner' | 'priority' | 'project' | 'tag';
export const FILTER_KEYS: TvFilterKey[] = ['status', 'owner', 'priority', 'project', 'tag'];
export const emptyFilter = (): TvFilter => ({ q: '', status: [], owner: [], priority: [], project: [], tag: [] });

/** The part of a screen's wiring the shared view needs. */
export interface TvSource {
  /** Where it is remembered (localStorage `py-tv-<key>`). */
  key: string;
  portal: boolean;
  /** My Tasks: closed tasks hidden unless asked, new tasks owned by me. */
  mine: boolean;
  groups: TvGroupId[];
  /** The project tab: every new task goes to this project. */
  lockedProjectId: string | null;
  /** Where the task page's back link returns to. */
  from: '' | 'tasks' | 'tasks-all';
  emptyHint: string;
  load(): Promise<TvLoaded>;
}

export interface TvGroup {
  id: string;
  label: string;
  items: TvTask[];
  status?: LayoutStatus;
  prio?: TaskPriority;
  /** Owner grouping: the person's id ('none' = unassigned). */
  ownerId?: string;
  list?: TaskList;
}

/** A small picture: a status ring, a priority bar, a person's avatar, or a toolbar glyph. */
export type TvIcon =
  | { k: 'status'; s: Pick<LayoutStatus, 'color' | 'statusType' | 'defaultStatus'> }
  | { k: 'prio'; p: TaskPriority }
  | { k: 'person'; name: string | null }
  | { k: 'ui'; n: string }
  | { k: 'tag' };

export interface TvItem {
  id: string;
  label: string;
  on?: boolean;
  icon?: TvIcon;
  /** A quiet note at the right (a date). */
  hint?: string;
  /** Show the 1-9 shortcut at the right. */
  num?: boolean;
  tag?: boolean;
}

/** One open picker: the items, what to do with a pick. Multi pickers toggle and stay open. */
export interface TvMenuSpec {
  anchor: HTMLElement;
  title?: string;
  search?: string;
  multi?: boolean;
  alignEnd?: boolean;
  /** Show the 1-9 shortcut at the right of the first nine rows. */
  num?: boolean;
  items: TvItem[];
  onPick: (id: string, items: TvItem[]) => void;
  /** A date input at the bottom (the due date picker). */
  onDate?: (iso: string) => void;
}

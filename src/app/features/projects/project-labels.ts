/** Icon and colour of each default project status (the Work service's ProjectConstants.STATUSES). */
export const STATUS_LOOK: Record<string, { cls: string; icon: string }> = {
  Active: { cls: 'progress', icon: 's-progress' },
  'In Progress': { cls: 'progress', icon: 's-progress' },
  'On Track': { cls: 'progress', icon: 's-progress' },
  Delayed: { cls: 'review', icon: 's-review' },
  'On Hold': { cls: 'open', icon: 'dot' },
  Completed: { cls: 'done', icon: 'check' },
  Cancelled: { cls: 'blocked', icon: 'alert' },
};

/** What each recorded project action reads like in the activity list. */
export const ACTIVITY_LABELS: Record<string, string | undefined> = {
  PROJECT_CREATED: 'Project created',
  PROJECT_UPDATED: 'Project updated',
  PROJECT_STATUS_CHANGED: 'Status changed',
  PROJECT_TRASHED: 'Moved to trash',
  PROJECT_RESTORED: 'Restored from trash',
  PROJECT_MEMBER_ADDED: 'Member added',
  PROJECT_MEMBER_REMOVED: 'Member removed',
};

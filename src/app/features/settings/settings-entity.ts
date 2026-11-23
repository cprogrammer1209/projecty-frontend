import { ActivatedRoute } from '@angular/router';

import { EntityType } from '../../core/customfield/custom-field.api';

/** Which module a shared settings page works on, read from the route's `entityType` data (default: projects). */
export interface SettingsEntity {
  type: EntityType;
  /** The URL segment under settings/: projects or tasks. */
  path: 'projects' | 'tasks';
  /** Singular and plural nouns for copy. */
  noun: string;
  nouns: string;
  /** Capitalised plural, for breadcrumbs. */
  title: string;
}

export function settingsEntity(route: ActivatedRoute): SettingsEntity {
  let r: ActivatedRoute | null = route;
  let type: EntityType = 'PROJECT';
  while (r) {
    const t = r.snapshot.data['entityType'];
    if (t === 'TASK' || t === 'PROJECT') {
      type = t;
      break;
    }
    r = r.parent;
  }
  return type === 'TASK'
    ? { type, path: 'tasks', noun: 'task', nouns: 'tasks', title: 'Tasks' }
    : { type, path: 'projects', noun: 'project', nouns: 'projects', title: 'Projects' };
}

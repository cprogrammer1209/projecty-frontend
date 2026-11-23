import { Permission } from '../../../core/member/member.api';

/** The settings navigation model, module-wise. Shared by the shell, the palette and the placeholder pages. */
export interface NavPage {
  id: string;
  label: string;
  icon: string;
  permission: Permission | null;
}

export const PORTAL_PAGES: NavPage[] = [
  { id: 'portal', label: 'Portal profile', icon: 'portal', permission: null },
  { id: 'users', label: 'Users & profiles', icon: 'users', permission: 'USERS_VIEW' },
  { id: 'audit', label: 'Audit log', icon: 'audit', permission: 'AUDIT_VIEW' },
  { id: 'preferences', label: 'My preferences', icon: 'prefs', permission: null },
];

export const PROJECT_PAGES: NavPage[] = [
  { id: 'fields', label: 'Fields', icon: 'fields', permission: 'CUSTOM_FIELDS_VIEW' },
  { id: 'layouts', label: 'Layouts', icon: 'layouts', permission: 'CUSTOM_FIELDS_VIEW' },
  { id: 'statuses', label: 'Statuses', icon: 'statuses', permission: 'PROJECTS_VIEW' },
  { id: 'templates', label: 'Templates', icon: 'templates', permission: 'PROJECTS_VIEW' },
];

export const TASK_PAGES: NavPage[] = [
  { id: 'fields', label: 'Fields', icon: 'fields', permission: 'CUSTOM_FIELDS_VIEW' },
  { id: 'layouts', label: 'Layouts', icon: 'layouts', permission: 'CUSTOM_FIELDS_VIEW' },
  { id: 'statuses', label: 'Statuses', icon: 'statuses', permission: 'CUSTOM_FIELDS_VIEW' },
];

export interface SoonModule {
  id: string;
  name: string;
  note: string;
  pages: string[];
}

export const SOON_MODULES: SoonModule[] = [
  {
    id: 'issues',
    name: 'Issues',
    note: 'Arrives with Step 9',
    pages: ['Fields', 'Layouts', 'Statuses'],
  },
  { id: 'documents', name: 'Documents', note: 'Arrives in M1', pages: ['Fields', 'Folders'] },
  { id: 'time', name: 'Time tracking', note: 'Planned for later', pages: ['Fields', 'Rules'] },
];

/** Page names of the placeholder lists to sprite icon names. */
export const PAGE_ICONS: Record<string, string> = {
  fields: 'fields',
  layouts: 'layouts',
  statuses: 'statuses',
  folders: 'projects',
  rules: 'prefs',
};

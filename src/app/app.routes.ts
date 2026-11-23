import { Routes } from '@angular/router';

import { authGuard, guestGuard, permissionGuard, portalGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/ui/unsaved-changes.guard';
import { AuthLayout } from './features/auth/layout/auth-layout';

const TITLE_SUFFIX = ' · ProjectY';

export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
      {
        path: 'sign-in',
        title: 'Sign in' + TITLE_SUFFIX,
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/sign-in/sign-in').then((m) => m.SignIn),
      },
      {
        path: 'sign-up',
        title: 'Create account' + TITLE_SUFFIX,
        canActivate: [guestGuard],
        data: { showcase: 'preview' },
        loadComponent: () => import('./features/auth/sign-up/sign-up').then((m) => m.SignUp),
      },
      {
        path: 'check-email',
        title: 'Check your email' + TITLE_SUFFIX,
        data: { showcase: 'preview' },
        loadComponent: () => import('./features/auth/check-email/check-email').then((m) => m.CheckEmail),
      },
      {
        path: 'verify-email',
        title: 'Confirm email' + TITLE_SUFFIX,
        loadComponent: () => import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmail),
      },
      {
        path: 'forgot-password',
        title: 'Reset password' + TITLE_SUFFIX,
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
      },
      {
        path: 'reset-password',
        title: 'Choose a new password' + TITLE_SUFFIX,
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
      },
      {
        path: 'impersonate',
        title: 'Support session' + TITLE_SUFFIX,
        loadComponent: () =>
          import('./features/support/impersonation-launch/impersonation-launch').then(
            (m) => m.ImpersonationLaunch,
          ),
      },
      {
        path: 'support-session-ended',
        title: 'Support session ended' + TITLE_SUFFIX,
        loadComponent: () =>
          import('./features/support/support-ended/support-ended').then((m) => m.SupportEnded),
      },
      {
        path: 'portals',
        title: 'Choose a portal' + TITLE_SUFFIX,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/auth/portal-picker/portal-picker').then((m) => m.PortalPicker),
      },
      {
        path: 'invite',
        title: 'Join a portal' + TITLE_SUFFIX,
        loadComponent: () =>
          import('./features/auth/accept-invite/accept-invite').then((m) => m.AcceptInvite),
      },
      {
        path: 'portal-not-found',
        title: 'Portal not found' + TITLE_SUFFIX,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/auth/portal-not-found/portal-not-found').then((m) => m.PortalNotFound),
      },
      {
        path: 'portals/new',
        title: 'Set up your portal' + TITLE_SUFFIX,
        canActivate: [authGuard],
        data: { showcase: 'preview' },
        loadComponent: () =>
          import('./features/auth/create-portal/create-portal').then((m) => m.CreatePortal),
      },
    ],
  },
  {
    // Settings has its own full-page shell (no app sidebar), so it is a sibling of the portal shell, not a child.
    path: 'p/:slug/settings',
    canActivate: [authGuard, portalGuard],
    loadComponent: () => import('./features/settings/shell/settings-shell').then((m) => m.SettingsShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'portal' },
      {
        path: 'portal',
        title: 'Portal profile' + TITLE_SUFFIX,
        data: { heading: ['Portal profile', 'How your portal looks and behaves for everyone in it.'] },
        loadComponent: () => import('./features/settings/portal-settings').then((m) => m.PortalSettings),
      },
      {
        path: 'users',
        title: 'Users & profiles' + TITLE_SUFFIX,
        data: { heading: ['Users & profiles', 'Who is in the portal, and what each profile may do.'], width: 'wide' },
        canActivate: [permissionGuard('USERS_VIEW')],
        loadComponent: () => import('./features/settings/users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'audit',
        title: 'Audit log' + TITLE_SUFFIX,
        data: { heading: ['Audit log', 'Every change to portal settings and people, newest first. Entries cannot be edited or deleted.'], width: 'wide' },
        canActivate: [permissionGuard('AUDIT_VIEW')],
        loadComponent: () => import('./features/settings/audit/audit-page').then((m) => m.AuditPage),
      },
      {
        path: 'preferences',
        title: 'My preferences' + TITLE_SUFFIX,
        data: { heading: ['My preferences', 'Only for you. Nobody else in the portal sees these.'] },
        loadComponent: () => import('./features/settings/my-preferences').then((m) => m.MyPreferences),
      },
      { path: 'projects', pathMatch: 'full', redirectTo: 'projects/fields' },
      {
        path: 'projects/fields',
        title: 'Fields · Projects' + TITLE_SUFFIX,
        data: { heading: ['Fields', 'Extra details every project can carry. Layouts decide where they appear.'], width: 'wide' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_VIEW')],
        loadComponent: () => import('./features/settings/fields/fields-page').then((m) => m.FieldsPage),
      },
      {
        path: 'projects/fields/new',
        title: 'New field · Projects' + TITLE_SUFFIX,
        data: { width: 'wide', topTitle: 'New field' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        loadComponent: () => import('./features/settings/fields/field-form').then((m) => m.FieldForm),
      },
      {
        path: 'projects/fields/:id/edit',
        title: 'Edit field · Projects' + TITLE_SUFFIX,
        data: { width: 'wide', topTitle: 'Edit field' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        loadComponent: () => import('./features/settings/fields/field-form').then((m) => m.FieldForm),
      },
      {
        path: 'projects/layouts',
        title: 'Layouts · Projects' + TITLE_SUFFIX,
        data: { topTitle: 'Layouts' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_VIEW')],
        loadComponent: () => import('./features/settings/layouts/layouts-page').then((m) => m.LayoutsPage),
      },
      {
        path: 'projects/layouts/:id',
        title: 'Edit layout · Projects' + TITLE_SUFFIX,
        data: { width: 'full', topTitle: 'Edit layout' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/settings/layouts/layout-builder').then((m) => m.LayoutBuilder),
      },
      {
        path: 'projects/statuses',
        title: 'Statuses · Projects' + TITLE_SUFFIX,
        data: { heading: ['Statuses', 'The stages a project moves through, grouped by what they mean.'] },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/settings/shell/settings-statuses').then((m) => m.SettingsStatuses),
      },
      {
        path: 'projects/templates',
        title: 'Templates · Projects' + TITLE_SUFFIX,
        data: { heading: ['Templates', 'Starting points for new projects.'] },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/settings/shell/settings-templates').then((m) => m.SettingsTemplates),
      },
      { path: 'tasks', pathMatch: 'full', redirectTo: 'tasks/fields' },
      {
        path: 'tasks/fields',
        title: 'Fields · Tasks' + TITLE_SUFFIX,
        data: { heading: ['Fields', 'Extra details every task can carry. Layouts decide where they appear.'], width: 'wide', entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_VIEW')],
        loadComponent: () => import('./features/settings/fields/fields-page').then((m) => m.FieldsPage),
      },
      {
        path: 'tasks/fields/new',
        title: 'New field · Tasks' + TITLE_SUFFIX,
        data: { width: 'wide', topTitle: 'New field', entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        loadComponent: () => import('./features/settings/fields/field-form').then((m) => m.FieldForm),
      },
      {
        path: 'tasks/fields/:id/edit',
        title: 'Edit field · Tasks' + TITLE_SUFFIX,
        data: { width: 'wide', topTitle: 'Edit field', entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        loadComponent: () => import('./features/settings/fields/field-form').then((m) => m.FieldForm),
      },
      {
        path: 'tasks/layouts',
        title: 'Layouts · Tasks' + TITLE_SUFFIX,
        data: { topTitle: 'Layouts', entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_VIEW')],
        loadComponent: () => import('./features/settings/layouts/layouts-page').then((m) => m.LayoutsPage),
      },
      {
        path: 'tasks/layouts/:id',
        title: 'Edit layout · Tasks' + TITLE_SUFFIX,
        data: { width: 'full', topTitle: 'Edit layout', entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_MANAGE')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/settings/layouts/layout-builder').then((m) => m.LayoutBuilder),
      },
      {
        path: 'tasks/statuses',
        title: 'Statuses · Tasks' + TITLE_SUFFIX,
        data: { heading: ['Statuses', 'The stages a task moves through. Every task layout has its own set.'], entityType: 'TASK' },
        canActivate: [permissionGuard('CUSTOM_FIELDS_VIEW')],
        loadComponent: () => import('./features/settings/statuses/task-statuses-page').then((m) => m.TaskStatusesPage),
      },
      {
        // Issues, Documents and Time tracking: their settings arrive with the modules.
        path: ':module',
        title: 'Settings' + TITLE_SUFFIX,
        data: { heading: 'module' },
        loadComponent: () => import('./features/settings/shell/settings-soon').then((m) => m.SettingsSoon),
      },
    ],
  },
  {
    path: 'p/:slug',
    canActivate: [authGuard, portalGuard],
    loadComponent: () => import('./features/shell/portal-shell').then((m) => m.PortalShell),
    children: [
      {
        path: '',
        title: 'Home' + TITLE_SUFFIX,
        data: { crumb: 'Home' },
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'projects',
        title: 'Projects' + TITLE_SUFFIX,
        data: { crumb: 'Projects', fluid: true },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/projects/projects-page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/new',
        title: 'New project' + TITLE_SUFFIX,
        data: { crumb: 'New project' },
        canActivate: [permissionGuard('PROJECTS_CREATE')],
        loadComponent: () => import('./features/projects/project-form').then((m) => m.ProjectForm),
      },
      {
        path: 'projects/trash',
        title: 'Project trash' + TITLE_SUFFIX,
        data: { crumb: 'Trash', fluid: true },
        canActivate: [permissionGuard('PROJECTS_DELETE')],
        loadComponent: () => import('./features/projects/projects-trash').then((m) => m.ProjectsTrash),
      },
      {
        path: 'projects/:id/edit',
        title: 'Edit project' + TITLE_SUFFIX,
        data: { crumb: 'Edit project' },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/projects/project-form').then((m) => m.ProjectForm),
      },
      {
        path: 'projects/:id/settings',
        title: 'Project settings' + TITLE_SUFFIX,
        data: { crumb: 'Project settings' },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/projects/project-settings').then((m) => m.ProjectSettings),
      },
      {
        path: 'tasks',
        title: 'Tasks' + TITLE_SUFFIX,
        data: { crumb: 'Tasks', fluid: true },
        canActivate: [permissionGuard('TASKS_VIEW')],
        loadComponent: () => import('./features/tasks/all-tasks').then((m) => m.AllTasks),
      },
      {
        path: 'projects/:id/tasks',
        title: 'Tasks' + TITLE_SUFFIX,
        data: { crumb: 'Tasks', fluid: true },
        canActivate: [permissionGuard('TASKS_VIEW')],
        loadComponent: () => import('./features/tasks/tasks-tab').then((m) => m.TasksTab),
      },
      {
        path: 'projects/:id/tasks/:tid',
        title: 'Task' + TITLE_SUFFIX,
        data: { crumb: 'Task', fluid: true },
        canActivate: [permissionGuard('TASKS_VIEW')],
        loadComponent: () => import('./features/tasks/task-detail').then((m) => m.TaskDetail),
      },
      {
        path: 'projects/:id',
        title: 'Project' + TITLE_SUFFIX,
        data: { crumb: 'Projects', fluid: true },
        canActivate: [permissionGuard('PROJECTS_VIEW')],
        loadComponent: () => import('./features/projects/project-overview').then((m) => m.ProjectOverview),
      },
    ],
  },
  { path: '**', redirectTo: 'sign-in' },
];

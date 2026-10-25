import { Routes } from '@angular/router';

import { authGuard, guestGuard, portalGuard } from './core/auth/auth.guards';
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
        path: 'settings',
        title: 'Settings' + TITLE_SUFFIX,
        data: { crumb: 'Settings' },
        loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'portal' },
          {
            path: 'portal',
            data: { crumb: 'Settings' },
            loadComponent: () => import('./features/settings/portal-settings').then((m) => m.PortalSettings),
          },
          {
            path: 'preferences',
            data: { crumb: 'My preferences' },
            loadComponent: () => import('./features/settings/my-preferences').then((m) => m.MyPreferences),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'sign-in' },
];

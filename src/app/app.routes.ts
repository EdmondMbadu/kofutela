import { Routes } from '@angular/router';
import { PUBLIC_PAGES } from './core/site';

export const routes: Routes = [
  ...PUBLIC_PAGES.map((path) => ({
    path,
    pathMatch: 'full' as const,
    loadComponent: () => import('./marketing/marketing').then((m) => m.Marketing),
  })),
  ...['login', 'signup', 'reset'].map((path) => ({
    path,
    loadComponent: () => import('./auth/auth').then((m) => m.AuthPage),
  })),
  { path: 'join', loadComponent: () => import('./auth/join').then((m) => m.Join) },
  ...['app', 'demo'].flatMap((prefix) => [
    {
      path: prefix,
      data: { demo: prefix === 'demo' },
      loadComponent: () => import('./workspace/workspace').then((m) => m.Workspace),
    },
    {
      path: `${prefix}/:section`,
      data: { demo: prefix === 'demo' },
      loadComponent: () => import('./workspace/workspace').then((m) => m.Workspace),
    },
  ]),
  ...['admin', 'super-admin'].map((path) => ({
    path,
    loadComponent: () => import('./admin/admin').then((m) => m.Admin),
  })),
  { path: '**', loadComponent: () => import('./shared/not-found').then((m) => m.NotFound) },
];

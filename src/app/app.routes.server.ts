import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  ...['app', 'demo'].map((prefix) => ({
    path: `${prefix}/:section`,
    renderMode: RenderMode.Prerender as const,
    async getPrerenderParams() {
      return [
        'dashboard',
        'properties',
        'tenants',
        'rent',
        'maintenance',
        'messages',
        'documents',
        'reports',
        'settings',
        'support',
      ].map((section) => ({ section }));
    },
  })),
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

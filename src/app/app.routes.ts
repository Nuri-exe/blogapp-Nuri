import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/blog-overview/blog-overview-page').then((m) => m.BlogOverviewPage),
  },
];

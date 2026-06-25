import { Routes } from '@angular/router';
import { blogResolver } from './feature/blog-detail/blog.resolver';

export const routes: Routes = [
  // Startseite: eager geladen
  {
    path: '',
    loadComponent: () =>
      import('./feature/blog-overview/blog-overview-page').then((m) => m.BlogOverviewPage),
  },
  // Detail-Seite: lazy geladen, Resolver laedt den Post vorab
  {
    path: 'blog/:id',
    loadComponent: () =>
      import('./feature/blog-detail/blog-detail-page').then((m) => m.BlogDetailPage),
    resolve: { blog: blogResolver },
  },
  // About: lazy geladen
  {
    path: 'about',
    loadComponent: () => import('./feature/about/about-page').then((m) => m.AboutPage),
  },
  // Wildcard MUSS als letzte Route stehen — faengt alle unbekannten URLs ab
  {
    path: '**',
    loadComponent: () => import('./feature/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];

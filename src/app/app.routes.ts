import { Routes } from '@angular/router';

import { BlogList } from './feature/blog/blog-list';
import { blogResolver } from './feature/blog/blog-resolver';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'blogs' },
  {
    path: 'blogs',
    component: BlogList,
    title: 'Beiträge — HFTM Blog',
  },
  {
    path: 'blogs/:id',
    loadComponent: () => import('./feature/blog/blog-detail').then((m) => m.BlogDetail),
    resolve: { blog: blogResolver },
    title: 'Beitrag — HFTM Blog',
  },
  {
    path: 'about',
    loadComponent: () => import('./feature/about/about'),
    title: 'Über — HFTM Blog',
  },
  {
    path: '**',
    loadComponent: () => import('./feature/not-found/not-found'),
    title: 'Nicht gefunden — HFTM Blog',
  },
];

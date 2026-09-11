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
  // Must stay above 'blogs/:id', otherwise 'new' would be read as an id.
  {
    path: 'blogs/new',
    loadComponent: () => import('./feature/blog/blog-form').then((m) => m.BlogForm),
    title: 'Neuer Beitrag — HFTM Blog',
  },
  // Same reason as 'blogs/new' above — must stay ahead of 'blogs/:id'.
  {
    path: 'blogs/create',
    loadComponent: () => import('./feature/blog/blog-create').then((m) => m.BlogCreate),
    title: 'Beitrag schreiben — HFTM Blog',
  },
  {
    path: 'blogs/:id',
    loadComponent: () => import('./feature/blog/blog-detail').then((m) => m.BlogDetail),
    resolve: { blog: blogResolver },
    title: 'Beitrag — HFTM Blog',
  },
  {
    path: 'blogs/:id/edit',
    loadComponent: () => import('./feature/blog/blog-form').then((m) => m.BlogForm),
    title: 'Beitrag bearbeiten — HFTM Blog',
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

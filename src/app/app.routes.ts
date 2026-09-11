import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth-guard';
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
  // authGuard never returns false — it returns true or a redirecting UrlTree —
  // so a blocked user is redirected instead of falling through to 'blogs/:id'.
  {
    path: 'blogs/new',
    canMatch: [authGuard],
    loadComponent: () => import('./feature/blog/blog-form').then((m) => m.BlogForm),
    title: 'Neuer Beitrag — HFTM Blog',
  },
  {
    path: 'blogs/:id',
    loadComponent: () => import('./feature/blog/blog-detail').then((m) => m.BlogDetail),
    resolve: { blog: blogResolver },
    title: 'Beitrag — HFTM Blog',
  },
  {
    path: 'blogs/:id/edit',
    canMatch: [authGuard],
    loadComponent: () => import('./feature/blog/blog-form').then((m) => m.BlogForm),
    title: 'Beitrag bearbeiten — HFTM Blog',
  },
  {
    path: 'login',
    loadComponent: () => import('./feature/auth/login'),
    title: 'Anmelden — HFTM Blog',
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

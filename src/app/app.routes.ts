import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'blogs' },
  {
    path: 'blogs',
    loadComponent: () => import('./feature/blog/blog-list'),
    title: 'Beiträge — HFTM Blog',
  },
  {
    path: 'about',
    loadComponent: () => import('./feature/about/about'),
    title: 'Über — HFTM Blog',
  },
  { path: '**', redirectTo: 'blogs' },
];

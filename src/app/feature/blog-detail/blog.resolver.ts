import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Blog } from '../../shared/blog-card/blog.model';
import { BlogService } from '../../shared/blog.service';

// Function-based Resolver: laeuft VOR der Navigation und laedt den Post.
// So ist die Detail-Seite sofort mit Daten da, kein Loading-Zustand.
export const blogResolver: ResolveFn<Blog | undefined> = (route) => {
  const blogService = inject(BlogService);
  const id = Number(route.paramMap.get('id'));
  return blogService.getById(id);
};

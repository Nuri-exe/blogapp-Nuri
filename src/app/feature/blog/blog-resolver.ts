import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';

import { Blog } from './blog-model';
import { BlogService } from './blog-service';

/**
 * Makes sure the entries are in the cache before the detail page renders, so
 * the page never shows a loading state of its own.
 */
export const blogResolver: ResolveFn<Blog | undefined> = async (route) => {
  const service = inject(BlogService);

  if (service.blogs().length === 0) {
    await service.getBlogs();
  }

  const idParam = route.paramMap.get('id');
  return idParam ? service.getById(Number(idParam)) : undefined;
};

import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';

import { Blog } from './blog-model';
import { BlogStateService } from './blog-state-service';

/**
 * Makes sure the entries are in the store before the detail page renders, so
 * that page never shows a loading state of its own.
 *
 * Note: only the detail route uses this. The overview loads through
 * `loadBlogs()` in `ngOnInit` on purpose — a resolver there would block
 * navigation and the loading/error states would never be visible.
 */
export const blogResolver: ResolveFn<Blog | undefined> = async (route) => {
  const state = inject(BlogStateService);

  if (state.blogs().length === 0) {
    await state.loadBlogs();
  }

  const idParam = route.paramMap.get('id');
  return idParam ? state.getById(Number(idParam)) : undefined;
};

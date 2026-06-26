import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';

import { Blog } from './blog-model';
import { BlogService } from './blog-service';

export const blogResolver: ResolveFn<Blog | undefined> = async (route) => {
  const service = inject(BlogService);
  await service.load();
  const idParam = route.paramMap.get('id');
  return idParam ? service.getById(Number(idParam)) : undefined;
};

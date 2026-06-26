import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Blog } from './blog-model';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);

  getBlogs(): Observable<Blog[]> {
    return this.http.get<Blog[]>('/data/blogs.json');
  }
}

import { Injectable } from '@angular/core';
import { Blog } from './blog-card/blog.model';
import blogData from '../data/blogs.json';

@Injectable({ providedIn: 'root' })
export class BlogService {
  // Daten zentral im Service halten (Singleton fuer die ganze App)
  private readonly blogs: Blog[] = blogData as Blog[];

  // Alle Blog-Posts zurueckgeben
  getAll(): Blog[] {
    return this.blogs;
  }

  // Einen einzelnen Post anhand der ID finden (undefined, wenn es ihn nicht gibt)
  getById(id: number): Blog | undefined {
    return this.blogs.find((b) => b.id === id);
  }
}

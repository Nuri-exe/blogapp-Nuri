import { Injectable, Signal, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Blog } from './blog-model';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly _blogs = signal<Blog[] | null>(null);
  private loadPromise: Promise<void> | null = null;

  readonly blogs: Signal<Blog[] | null> = this._blogs.asReadonly();

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = firstValueFrom(this.http.get<Blog[]>('/data/blogs.json')).then((blogs) => {
      this._blogs.set(blogs);
    });
    return this.loadPromise;
  }

  getAll(): Blog[] | null {
    if (!this.loadPromise) void this.load();
    return this._blogs();
  }

  getById(id: number): Blog | undefined {
    return this._blogs()?.find((b) => b.id === id);
  }

  toggleLike(id: number): void {
    this._blogs.update((list) =>
      list
        ? list.map((b) =>
            b.id === id
              ? { ...b, likedByMe: !b.likedByMe, likes: b.likes + (b.likedByMe ? -1 : 1) }
              : b,
          )
        : list,
    );
  }
}

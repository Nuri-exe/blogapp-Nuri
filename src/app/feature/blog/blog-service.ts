import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type { ZodError } from 'zod';

import { environment } from '../../../environments/environment';
import { Blog, BlogInput } from './blog-model';

/** Sample data shipped in `public/`; used whenever the backend is unreachable. */
const FALLBACK_URL = '/data/blogs.json';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/entries`;

  private readonly _blogs = signal<Blog[]>([]);
  private readonly _offline = signal(false);

  private schemaModule: Promise<typeof import('./blog-schema')> | null = null;

  /** Cached entries — pages read this signal instead of re-fetching. */
  readonly blogs = this._blogs.asReadonly();

  /** True when the last operation could not reach the backend. */
  readonly offline = this._offline.asReadonly();

  /** GET /entries — loads every blog entry. */
  async getBlogs(): Promise<Blog[]> {
    try {
      const payload = await firstValueFrom(
        this.http.get<unknown>(this.apiUrl).pipe(timeout(environment.apiTimeoutMs)),
      );
      const blogs = await this.parseList(payload);
      this._offline.set(false);
      this._blogs.set(blogs);
      return blogs;
    } catch (error) {
      console.error(`[BlogService] GET ${this.apiUrl} failed — falling back to local data.`, error);
      return this.loadFallback();
    }
  }

  /** GET /entries/:id — loads a single entry, falling back to the cache. */
  async getBlog(id: number): Promise<Blog | undefined> {
    try {
      const payload = await firstValueFrom(
        this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(timeout(environment.apiTimeoutMs)),
      );
      const blog = await this.parseEntry(`GET ${this.apiUrl}/${id}`, payload);
      if (!blog) return this.getById(id);

      this._offline.set(false);
      this.upsert(blog);
      return blog;
    } catch (error) {
      console.error(`[BlogService] GET ${this.apiUrl}/${id} failed — using cached entry.`, error);
      if (this._blogs().length === 0) {
        await this.getBlogs();
      }
      return this.getById(id);
    }
  }

  /** POST /entries — creates a new entry. */
  async createBlog(blog: BlogInput): Promise<Blog | null> {
    try {
      const payload = await firstValueFrom(
        this.http.post<unknown>(this.apiUrl, blog).pipe(timeout(environment.apiTimeoutMs)),
      );
      const created = await this.parseEntry(`POST ${this.apiUrl}`, payload);
      if (!created) return this.createLocally(blog);

      this._offline.set(false);
      this.upsert(created);
      return created;
    } catch (error) {
      console.error(`[BlogService] POST ${this.apiUrl} failed — storing entry locally.`, error);
      return this.createLocally(blog);
    }
  }

  /** PUT /entries/:id — replaces an existing entry. */
  async updateBlog(id: number, blog: BlogInput): Promise<Blog | null> {
    try {
      const payload = await firstValueFrom(
        this.http
          .put<unknown>(`${this.apiUrl}/${id}`, blog)
          .pipe(timeout(environment.apiTimeoutMs)),
      );
      const updated = await this.parseEntry(`PUT ${this.apiUrl}/${id}`, payload);
      if (!updated) return this.updateLocally(id, blog);

      this._offline.set(false);
      this.upsert(updated);
      return updated;
    } catch (error) {
      console.error(
        `[BlogService] PUT ${this.apiUrl}/${id} failed — updating entry locally.`,
        error,
      );
      return this.updateLocally(id, blog);
    }
  }

  /** DELETE /entries/:id — removes an entry. */
  async deleteBlog(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(timeout(environment.apiTimeoutMs)),
      );
      this._offline.set(false);
      this.removeLocally(id);
      return true;
    } catch (error) {
      console.error(
        `[BlogService] DELETE ${this.apiUrl}/${id} failed — removing entry locally.`,
        error,
      );
      this._offline.set(true);
      this.removeLocally(id);
      return false;
    }
  }

  /** Synchronous cache lookup — used by the detail page and the route resolver. */
  getById(id: number): Blog | undefined {
    return this._blogs().find((blog) => blog.id === id);
  }

  /** Optimistic, client-side like toggle. */
  toggleLike(id: number): void {
    this._blogs.update((list) =>
      list.map((blog) =>
        blog.id === id
          ? { ...blog, likedByMe: !blog.likedByMe, likes: blog.likes + (blog.likedByMe ? -1 : 1) }
          : blog,
      ),
    );
  }

  // ---------------------------------------------------------------- internals

  /**
   * zod costs roughly 65 kB gzipped — far too much for the initial bundle when
   * it is only needed once a response actually arrives. Loading it on demand
   * keeps startup lean; the promise is cached so it resolves once per session.
   */
  private schemas(): Promise<typeof import('./blog-schema')> {
    this.schemaModule ??= import('./blog-schema');
    return this.schemaModule;
  }

  /**
   * Unwraps the list payload and validates each entry on its own, so one broken
   * record costs a single card rather than the whole page.
   */
  private async parseList(payload: unknown): Promise<Blog[]> {
    const { blogListPayloadSchema, blogSchema } = await this.schemas();

    const envelope = blogListPayloadSchema.safeParse(payload);
    if (!envelope.success) {
      this.logInvalid('Blog list response', envelope.error);
      return [];
    }

    const items = Array.isArray(envelope.data) ? envelope.data : envelope.data.data;
    const blogs: Blog[] = [];
    let skipped = 0;

    for (const item of items) {
      const parsed = blogSchema.safeParse(item);
      if (parsed.success) {
        blogs.push(parsed.data);
      } else {
        skipped += 1;
        console.warn('[BlogService] Skipping invalid blog entry.', parsed.error.issues);
      }
    }

    if (skipped > 0) {
      console.error(`[BlogService] Dropped ${skipped} invalid entries from the API response.`);
    }

    return blogs;
  }

  /** Validates a single-entry response; returns null when it does not match. */
  private async parseEntry(context: string, payload: unknown): Promise<Blog | null> {
    const { blogSchema } = await this.schemas();

    const parsed = blogSchema.safeParse(payload);
    if (!parsed.success) {
      this.logInvalid(context, parsed.error);
      return null;
    }

    return parsed.data;
  }

  private async loadFallback(): Promise<Blog[]> {
    try {
      const payload = await firstValueFrom(this.http.get<unknown>(FALLBACK_URL));
      const blogs = await this.parseList(payload);
      this._offline.set(true);
      this._blogs.set(blogs);
      return blogs;
    } catch (error) {
      console.error(`[BlogService] Local fallback ${FALLBACK_URL} failed as well.`, error);
      this._offline.set(true);
      this._blogs.set([]);
      return [];
    }
  }

  private createLocally(input: BlogInput): Blog {
    const now = new Date().toISOString();
    const blog: Blog = {
      id: this._blogs().reduce((max, entry) => Math.max(max, entry.id), 0) + 1,
      title: input.title,
      contentPreview: input.contentPreview,
      author: input.author,
      headerImageUrl: input.headerImageUrl,
      likes: 0,
      comments: 0,
      likedByMe: false,
      createdByMe: true,
      createdAt: now,
      updatedAt: now,
    };

    this._offline.set(true);
    this._blogs.update((list) => [blog, ...list]);
    return blog;
  }

  private updateLocally(id: number, input: BlogInput): Blog | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const updated: Blog = {
      ...existing,
      title: input.title,
      contentPreview: input.contentPreview,
      author: input.author,
      headerImageUrl: input.headerImageUrl,
      updatedAt: new Date().toISOString(),
    };

    this._offline.set(true);
    this.upsert(updated);
    return updated;
  }

  private removeLocally(id: number): void {
    this._blogs.update((list) => list.filter((blog) => blog.id !== id));
  }

  private upsert(blog: Blog): void {
    this._blogs.update((list) => {
      const index = list.findIndex((entry) => entry.id === blog.id);
      if (index === -1) return [blog, ...list];

      const next = [...list];
      next[index] = blog;
      return next;
    });
  }

  private logInvalid(context: string, error: ZodError): void {
    console.error(`[BlogService] ${context} returned data that failed validation.`, error.issues);
  }
}

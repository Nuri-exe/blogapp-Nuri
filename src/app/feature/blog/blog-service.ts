import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type { ZodError } from 'zod';

import { environment } from '../../../environments/environment';
import { Blog, BlogInput } from './blog-model';

/** Sample data shipped in `public/`; used when the backend cannot be reached. */
const FALLBACK_URL = '/data/blogs.json';

/**
 * Backend gateway — talks HTTP and validates payloads, nothing else.
 *
 * This service deliberately holds no state: the single source of truth is
 * `BlogStateService`. Failures are thrown rather than swallowed so the state
 * layer can decide which reducer to run.
 */
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/entries`;

  private schemaModule: Promise<typeof import('./blog-schema')> | null = null;

  /** GET /entries — throws when the backend is unreachable. */
  async getBlogs(): Promise<Blog[]> {
    const payload = await firstValueFrom(
      this.http.get<unknown>(this.apiUrl).pipe(timeout(environment.apiTimeoutMs)),
    );
    return this.parseList(payload);
  }

  /** Reads the bundled sample data — the offline fallback for the overview. */
  async getFallbackBlogs(): Promise<Blog[]> {
    const payload = await firstValueFrom(this.http.get<unknown>(FALLBACK_URL));
    return this.parseList(payload);
  }

  /** GET /entries/:id */
  async getBlog(id: number): Promise<Blog> {
    const payload = await firstValueFrom(
      this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(timeout(environment.apiTimeoutMs)),
    );
    return this.parseEntry(`GET ${this.apiUrl}/${id}`, payload);
  }

  /** POST /entries */
  async createBlog(blog: BlogInput): Promise<Blog> {
    const payload = await firstValueFrom(
      this.http.post<unknown>(this.apiUrl, blog).pipe(timeout(environment.apiTimeoutMs)),
    );
    return this.parseEntry(`POST ${this.apiUrl}`, payload);
  }

  /** PUT /entries/:id */
  async updateBlog(id: number, blog: BlogInput): Promise<Blog> {
    const payload = await firstValueFrom(
      this.http.put<unknown>(`${this.apiUrl}/${id}`, blog).pipe(timeout(environment.apiTimeoutMs)),
    );
    return this.parseEntry(`PUT ${this.apiUrl}/${id}`, payload);
  }

  /** DELETE /entries/:id */
  async deleteBlog(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(timeout(environment.apiTimeoutMs)),
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

  /** Validates a single-entry response; throws when it does not match. */
  private async parseEntry(context: string, payload: unknown): Promise<Blog> {
    const { blogSchema } = await this.schemas();

    const parsed = blogSchema.safeParse(payload);
    if (!parsed.success) {
      this.logInvalid(context, parsed.error);
      throw new Error(`${context} returned data in an unexpected shape.`);
    }

    return parsed.data;
  }

  private logInvalid(context: string, error: ZodError): void {
    console.error(`[BlogService] ${context} returned data that failed validation.`, error.issues);
  }
}

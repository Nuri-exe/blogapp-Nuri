import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { BlogService } from './blog-service';

const API = `${environment.apiBaseUrl}/entries`;
const FALLBACK = '/data/blogs.json';

/** Lets pending microtasks (and the lazy `blog-schema` import) settle. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Erster Beitrag',
    contentPreview: 'Ein kurzer Vorschautext.',
    author: 'Maria Keller',
    likes: 3,
    comments: 1,
    likedByMe: false,
    createdByMe: false,
    headerImageUrl: 'https://example.test/header.png',
    createdAt: '2026-02-15T10:30:00',
    updatedAt: '2026-02-16T08:15:00',
    ...overrides,
  };
}

describe('BlogService', () => {
  let service: BlogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // The service logs every rejected payload on purpose; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BlogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  /** Seeds the cache through the regular GET path. */
  async function seed(entries: Record<string, unknown>[] = [entry()]) {
    const promise = service.getBlogs();
    httpMock.expectOne(API).flush({ data: entries });
    await promise;
  }

  describe('getBlogs', () => {
    it('unwraps the paginated envelope', async () => {
      const promise = service.getBlogs();

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [entry()], pageIndex: 0, pageSize: 20, totalCount: 1, maxPageSize: 50 });

      const blogs = await promise;
      expect(blogs).toHaveLength(1);
      expect(blogs[0].title).toBe('Erster Beitrag');
      expect(service.blogs()).toEqual(blogs);
      expect(service.offline()).toBe(false);
    });

    it('also accepts a bare array', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush([entry(), entry({ id: 2 })]);

      expect(await promise).toHaveLength(2);
    });

    it('drops invalid entries but keeps the valid ones', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush({
        data: [entry(), { id: 'not-a-number', title: 'kaputt' }, { title: 'ohne id' }],
      });

      const blogs = await promise;
      expect(blogs).toHaveLength(1);
      expect(blogs[0].id).toBe(1);
    });

    it('fills missing optional fields with defaults', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush([{ id: 7, title: 'Nur Pflichtfelder' }]);

      const [blog] = await promise;
      expect(blog).toMatchObject({
        id: 7,
        title: 'Nur Pflichtfelder',
        contentPreview: '',
        author: 'Unbekannt',
        likes: 0,
        comments: 0,
        likedByMe: false,
        createdByMe: false,
      });
      expect(blog.headerImageUrl).toBeUndefined();
    });

    it('returns an empty list when the payload has no recognisable shape', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush({ unexpected: true });

      expect(await promise).toEqual([]);
    });

    it('falls back to the local sample data when the backend fails', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush('boom', { status: 500, statusText: 'Server Error' });

      await tick();
      httpMock.expectOne(FALLBACK).flush([entry({ id: 42 })]);

      const blogs = await promise;
      expect(blogs[0].id).toBe(42);
      expect(service.offline()).toBe(true);
    });

    it('degrades to an empty list when even the fallback fails', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush('boom', { status: 500, statusText: 'Server Error' });

      await tick();
      httpMock.expectOne(FALLBACK).flush('gone', { status: 404, statusText: 'Not Found' });

      expect(await promise).toEqual([]);
      expect(service.blogs()).toEqual([]);
    });
  });

  describe('createBlog', () => {
    it('POSTs the payload and caches the created entry', async () => {
      const promise = service.createBlog({
        title: 'Neuer Beitrag',
        contentPreview: 'Ein frischer Text.',
        author: 'Nuri',
      });

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({ title: 'Neuer Beitrag', author: 'Nuri' });
      req.flush(entry({ id: 99, title: 'Neuer Beitrag' }));

      const created = await promise;
      expect(created?.id).toBe(99);
      expect(service.getById(99)?.title).toBe('Neuer Beitrag');
    });

    it('keeps the entry locally when the backend is unreachable', async () => {
      const promise = service.createBlog({
        title: 'Offline-Beitrag',
        contentPreview: 'Wird lokal gehalten.',
        author: 'Nuri',
      });

      httpMock.expectOne(API).flush('down', { status: 503, statusText: 'Unavailable' });

      const created = await promise;
      expect(created?.title).toBe('Offline-Beitrag');
      expect(service.offline()).toBe(true);
      expect(service.blogs()).toHaveLength(1);
    });
  });

  describe('updateBlog', () => {
    it('PUTs to the entry URL and replaces the cached entry', async () => {
      await seed();

      const promise = service.updateBlog(1, {
        title: 'Überarbeitet',
        contentPreview: 'Neuer Inhalt.',
        author: 'Maria Keller',
      });

      const req = httpMock.expectOne(`${API}/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(entry({ title: 'Überarbeitet' }));

      await promise;
      expect(service.getById(1)?.title).toBe('Überarbeitet');
      expect(service.blogs()).toHaveLength(1);
    });
  });

  describe('deleteBlog', () => {
    it('DELETEs the entry and drops it from the cache', async () => {
      await seed();

      const promise = service.deleteBlog(1);
      const req = httpMock.expectOne(`${API}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(await promise).toBe(true);
      expect(service.getById(1)).toBeUndefined();
    });

    it('still removes the entry locally when the backend rejects', async () => {
      await seed();

      const promise = service.deleteBlog(1);
      httpMock.expectOne(`${API}/1`).flush('nope', { status: 503, statusText: 'Unavailable' });

      expect(await promise).toBe(false);
      expect(service.getById(1)).toBeUndefined();
      expect(service.offline()).toBe(true);
    });
  });

  describe('toggleLike', () => {
    it('flips the flag and adjusts the counter', async () => {
      await seed();

      service.toggleLike(1);
      expect(service.getById(1)).toMatchObject({ likedByMe: true, likes: 4 });

      service.toggleLike(1);
      expect(service.getById(1)).toMatchObject({ likedByMe: false, likes: 3 });
    });
  });
});

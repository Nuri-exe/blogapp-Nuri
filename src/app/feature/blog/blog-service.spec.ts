import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { BlogService } from './blog-service';

const API = `${environment.apiBaseUrl}/entries`;
const FALLBACK = '/data/blogs.json';

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

describe('BlogService (backend gateway)', () => {
  let service: BlogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // The service logs every rejected payload on purpose; keep the output clean.
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

  describe('getBlogs', () => {
    it('unwraps the paginated envelope', async () => {
      const promise = service.getBlogs();

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [entry()], pageIndex: 0, pageSize: 20, totalCount: 1, maxPageSize: 50 });

      const blogs = await promise;
      expect(blogs).toHaveLength(1);
      expect(blogs[0].title).toBe('Erster Beitrag');
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

    it('keeps only https image locations', async () => {
      const promise = service.getBlogs();
      httpMock
        .expectOne(API)
        .flush([
          entry({ id: 1, headerImageUrl: 'http://insecure.example/a.png' }),
          entry({ id: 2, headerImageUrl: 'javascript:alert(1)' }),
          entry({ id: 3, headerImageUrl: 'https://cdn.example/b.png' }),
        ]);

      const blogs = await promise;
      expect(blogs.map((blog) => blog.headerImageUrl)).toEqual([
        undefined,
        undefined,
        'https://cdn.example/b.png',
      ]);
    });

    it('returns an empty list when the payload has no recognisable shape', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush({ unexpected: true });

      expect(await promise).toEqual([]);
    });

    it('rejects when the backend fails, instead of swallowing the error', async () => {
      const promise = service.getBlogs();
      httpMock.expectOne(API).flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toBeDefined();
    });
  });

  describe('getFallbackBlogs', () => {
    it('reads the bundled sample data', async () => {
      const promise = service.getFallbackBlogs();

      const req = httpMock.expectOne(FALLBACK);
      expect(req.request.method).toBe('GET');
      req.flush([entry({ id: 42 })]);

      const blogs = await promise;
      expect(blogs[0].id).toBe(42);
    });
  });

  describe('write operations', () => {
    it('POSTs the payload and returns the created entry', async () => {
      const promise = service.createBlog({
        title: 'Neuer Beitrag',
        contentPreview: 'Ein frischer Text.',
        author: 'Nuri',
      });

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({ title: 'Neuer Beitrag', author: 'Nuri' });
      req.flush(entry({ id: 99, title: 'Neuer Beitrag' }));

      expect((await promise).id).toBe(99);
    });

    it('rejects when the created entry comes back malformed', async () => {
      const promise = service.createBlog({
        title: 'Neuer Beitrag',
        contentPreview: 'Ein frischer Text.',
        author: 'Nuri',
      });

      httpMock.expectOne(API).flush({ nonsense: true });

      await expect(promise).rejects.toThrow(/unexpected shape/);
    });

    it('PUTs to the entry URL', async () => {
      const promise = service.updateBlog(1, {
        title: 'Überarbeitet',
        contentPreview: 'Neuer Inhalt.',
        author: 'Maria Keller',
      });

      const req = httpMock.expectOne(`${API}/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(entry({ title: 'Überarbeitet' }));

      expect((await promise).title).toBe('Überarbeitet');
    });

    it('DELETEs the entry URL', async () => {
      const promise = service.deleteBlog(1);

      const req = httpMock.expectOne(`${API}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await expect(promise).resolves.toBeUndefined();
    });
  });
});

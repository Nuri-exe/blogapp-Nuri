import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Blog } from './blog-model';
import { BlogService } from './blog-service';
import { ALL_AUTHORS, BlogStateService } from './blog-state-service';

const STORAGE_KEY = 'blogapp.selectedAuthor';

function blog(overrides: Partial<Blog> = {}): Blog {
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

/** Stand-in for the HTTP gateway — these tests are about state, not transport. */
function backendMock() {
  return {
    getBlogs: vi.fn<() => Promise<Blog[]>>(),
    getFallbackBlogs: vi.fn<() => Promise<Blog[]>>(),
    createBlog: vi.fn<() => Promise<Blog>>(),
    updateBlog: vi.fn<() => Promise<Blog>>(),
    deleteBlog: vi.fn<() => Promise<void>>(),
  };
}

describe('BlogStateService', () => {
  let backend: ReturnType<typeof backendMock>;

  /** Builds the service after localStorage has been arranged for the test. */
  function createService(): BlogStateService {
    TestBed.configureTestingModule({
      providers: [{ provide: BlogService, useValue: backend }],
    });
    return TestBed.inject(BlogStateService);
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.clear();
    backend = backendMock();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  describe('encapsulation', () => {
    it('exposes read-only selectors, so components cannot write the state', () => {
      const service = createService();

      // computed() signals have no set/update — this is what keeps the state
      // in one place instead of scattered across components.
      expect('set' in service.blogs).toBe(false);
      expect('update' in service.blogs).toBe(false);
      expect('set' in service.loading).toBe(false);
      expect('set' in service.error).toBe(false);
    });

    it('starts empty and idle', () => {
      const service = createService();

      expect(service.blogs()).toEqual([]);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
      expect(service.blogCount()).toBe(0);
      expect(service.selectedAuthor()).toBe(ALL_AUTHORS);
    });
  });

  describe('loadBlogs', () => {
    it('flips loading on while the request is in flight and off afterwards', async () => {
      let resolve!: (blogs: Blog[]) => void;
      backend.getBlogs.mockReturnValue(
        new Promise<Blog[]>((r) => {
          resolve = r;
        }),
      );

      const service = createService();
      const pending = service.loadBlogs();
      expect(service.loading()).toBe(true);

      resolve([blog()]);
      await pending;

      expect(service.loading()).toBe(false);
      expect(service.blogs()).toHaveLength(1);
      expect(service.blogCount()).toBe(1);
      expect(service.offline()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('clears a previous error when a new load starts', async () => {
      backend.getBlogs.mockRejectedValue(new Error('down'));
      backend.getFallbackBlogs.mockRejectedValue(new Error('missing'));

      const service = createService();
      await service.loadBlogs();
      expect(service.error()).not.toBeNull();

      backend.getBlogs.mockResolvedValue([blog()]);
      await service.loadBlogs();
      expect(service.error()).toBeNull();
    });

    it('falls back to the bundled data and flags offline when the API is down', async () => {
      backend.getBlogs.mockRejectedValue(new Error('down'));
      backend.getFallbackBlogs.mockResolvedValue([blog({ id: 42 })]);

      const service = createService();
      await service.loadBlogs();

      expect(service.blogs()[0].id).toBe(42);
      expect(service.offline()).toBe(true);
      expect(service.error()).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('surfaces an error when the fallback fails as well', async () => {
      backend.getBlogs.mockRejectedValue(new Error('down'));
      backend.getFallbackBlogs.mockRejectedValue(new Error('missing'));

      const service = createService();
      await service.loadBlogs();

      expect(service.blogs()).toEqual([]);
      expect(service.error()).toBe('Beiträge konnten nicht geladen werden.');
      expect(service.loading()).toBe(false);
      expect(service.offline()).toBe(false);
    });

    it('discards a load once a newer load has already committed', async () => {
      let resolveSlow!: (blogs: Blog[]) => void;
      backend.getBlogs
        .mockReturnValueOnce(
          new Promise<Blog[]>((resolve) => {
            resolveSlow = resolve;
          }),
        )
        .mockResolvedValueOnce([blog({ id: 2, title: 'Frisch' })]);

      const service = createService();
      const slow = service.loadBlogs();
      await service.loadBlogs();
      expect(service.getById(2)?.title).toBe('Frisch');

      // The first request finally answers — it must not win any more.
      resolveSlow([blog({ id: 1, title: 'Veraltet' })]);
      await slow;

      expect(service.getById(2)).toBeDefined();
      expect(service.getById(1)).toBeUndefined();
    });

    it('does not let a late fallback overwrite an entry created meanwhile', async () => {
      let rejectSlow!: (reason: unknown) => void;
      backend.getBlogs.mockReturnValue(
        new Promise<Blog[]>((_resolve, reject) => {
          rejectSlow = reject;
        }),
      );
      backend.getFallbackBlogs.mockResolvedValue([blog({ id: 99, title: 'Beispieldaten' })]);

      const service = createService();
      const slow = service.loadBlogs();

      backend.createBlog.mockResolvedValue(blog({ id: 5, title: 'Neu' }));
      await service.createBlog({ title: 'Neu', contentPreview: 'Text …', author: 'Nuri' });
      expect(service.getById(5)).toBeDefined();

      // The stalled request times out after the write already landed.
      rejectSlow(new Error('timeout'));
      await slow;

      expect(service.getById(5)).toBeDefined();
      expect(service.getById(99)).toBeUndefined();
      expect(backend.getFallbackBlogs).not.toHaveBeenCalled();
      expect(service.offline()).toBe(false);
    });

    it('keeps already loaded entries when a later reload fails', async () => {
      backend.getBlogs.mockResolvedValue([blog({ id: 7 })]);
      const service = createService();
      await service.loadBlogs();
      expect(service.blogCount()).toBe(1);

      backend.getBlogs.mockRejectedValue(new Error('down'));
      backend.getFallbackBlogs.mockRejectedValue(new Error('missing'));
      await service.loadBlogs();

      expect(service.error()).not.toBeNull();
      expect(service.blogCount()).toBe(1);
    });
  });

  describe('clearError', () => {
    it('empties the shared error slot so it cannot follow the user to another page', async () => {
      backend.getBlogs.mockRejectedValue(new Error('down'));
      backend.getFallbackBlogs.mockRejectedValue(new Error('missing'));

      const service = createService();
      await service.loadBlogs();
      expect(service.error()).not.toBeNull();

      service.clearError();

      expect(service.error()).toBeNull();
    });
  });

  describe('author filter', () => {
    async function serviceWithAuthors(): Promise<BlogStateService> {
      backend.getBlogs.mockResolvedValue([
        blog({ id: 1, author: 'Maria Keller' }),
        blog({ id: 2, author: 'Jonas Müller' }),
        blog({ id: 3, author: 'Maria Keller' }),
      ]);

      const service = createService();
      await service.loadBlogs();
      return service;
    }

    it('lists every author once, alphabetically', async () => {
      const service = await serviceWithAuthors();
      expect(service.authors()).toEqual(['Jonas Müller', 'Maria Keller']);
    });

    it('returns everything while the filter is "all"', async () => {
      const service = await serviceWithAuthors();
      expect(service.filteredBlogs()).toHaveLength(3);
    });

    it('narrows the list to the selected author', async () => {
      const service = await serviceWithAuthors();

      service.setAuthor('Maria Keller');

      expect(service.selectedAuthor()).toBe('Maria Keller');
      expect(service.filteredBlogs()).toHaveLength(2);
      // blogCount stays the unfiltered total.
      expect(service.blogCount()).toBe(3);
    });

    it('recomputes when the underlying list changes', async () => {
      const service = await serviceWithAuthors();
      service.setAuthor('Jonas Müller');
      expect(service.filteredBlogs()).toHaveLength(1);

      backend.createBlog.mockResolvedValue(blog({ id: 4, author: 'Jonas Müller' }));
      await service.createBlog({ title: 'Neu', contentPreview: 'Text …', author: 'Jonas Müller' });

      expect(service.filteredBlogs()).toHaveLength(2);
    });
  });

  describe('localStorage persistence', () => {
    it('writes the selected author on change', async () => {
      backend.getBlogs.mockResolvedValue([blog()]);
      const service = createService();

      service.setAuthor('Maria Keller');
      TestBed.tick();

      expect(localStorage.getItem(STORAGE_KEY)).toBe('Maria Keller');
    });

    it('restores the stored author on start-up', () => {
      localStorage.setItem(STORAGE_KEY, 'Jonas Müller');

      const service = createService();

      expect(service.selectedAuthor()).toBe('Jonas Müller');
    });
  });

  describe('mutations', () => {
    async function loadedService(): Promise<BlogStateService> {
      backend.getBlogs.mockResolvedValue([blog({ id: 1 })]);
      const service = createService();
      await service.loadBlogs();
      return service;
    }

    it('prepends a created entry', async () => {
      const service = await loadedService();
      backend.createBlog.mockResolvedValue(blog({ id: 99, title: 'Neu' }));

      const created = await service.createBlog({
        title: 'Neu',
        contentPreview: 'Text …',
        author: 'Nuri',
      });

      expect(created?.id).toBe(99);
      expect(service.blogs()[0].id).toBe(99);
      expect(service.blogCount()).toBe(2);
      expect(service.loading()).toBe(false);
    });

    it('replaces an updated entry in place', async () => {
      const service = await loadedService();
      backend.updateBlog.mockResolvedValue(blog({ id: 1, title: 'Überarbeitet' }));

      await service.updateBlog(1, {
        title: 'Überarbeitet',
        contentPreview: 'Text …',
        author: 'Maria Keller',
      });

      expect(service.blogs()).toHaveLength(1);
      expect(service.getById(1)?.title).toBe('Überarbeitet');
    });

    it('drops a deleted entry', async () => {
      const service = await loadedService();
      backend.deleteBlog.mockResolvedValue(undefined);

      expect(await service.deleteBlog(1)).toBe(true);
      expect(service.getById(1)).toBeUndefined();
      expect(service.blogCount()).toBe(0);
    });

    it('reports an error and keeps the list when a write fails', async () => {
      const service = await loadedService();
      backend.deleteBlog.mockRejectedValue(new Error('nope'));

      expect(await service.deleteBlog(1)).toBe(false);
      expect(service.error()).toBe('Der Beitrag konnte nicht gelöscht werden.');
      expect(service.blogCount()).toBe(1);
      expect(service.loading()).toBe(false);
    });

    it('toggles a like both ways', async () => {
      const service = await loadedService();

      service.toggleLike(1);
      expect(service.getById(1)).toMatchObject({ likedByMe: true, likes: 4 });

      service.toggleLike(1);
      expect(service.getById(1)).toMatchObject({ likedByMe: false, likes: 3 });
    });
  });
});

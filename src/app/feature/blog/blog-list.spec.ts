import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MatSelect } from '@angular/material/select';
import { vi } from 'vitest';

import { AuthStore } from '../../core/auth/auth-store';
import { Blog } from './blog-model';
import { BlogList } from './blog-list';
import { ALL_AUTHORS, BlogStateService } from './blog-state-service';

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
    headerImageUrl: undefined,
    createdAt: '2026-02-15T10:30:00',
    updatedAt: '2026-02-16T08:15:00',
    ...overrides,
  };
}

/**
 * The store as the list sees it: read-only signals plus three actions. Every
 * signal is writable here so a test can put the page into any state directly,
 * without running the real loading logic (that has its own spec).
 */
function stateFake() {
  return {
    filteredBlogs: signal<Blog[]>([]),
    blogCount: signal(0),
    authors: signal<string[]>([]),
    selectedAuthor: signal(ALL_AUTHORS),
    loading: signal(false),
    error: signal<string | null>(null),
    offline: signal(false),
    loadBlogs: vi.fn(() => Promise.resolve()),
    setAuthor: vi.fn(),
    toggleLike: vi.fn(),
  };
}

/**
 * The overview page, rendered against a fake store. The acceptance criteria of
 * the end-to-end suite (entries shown, title + summary, author filter) are
 * checked here too — cheaply, deterministically and without a browser.
 */
describe('BlogList', () => {
  let state: ReturnType<typeof stateFake>;
  let canWrite: ReturnType<typeof signal<boolean>>;
  let fixture: ComponentFixture<BlogList>;
  let host: HTMLElement;

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(BlogList);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const text = (selector: string) => host.querySelector(selector)?.textContent?.trim();
  const cards = () => host.querySelectorAll('app-blog-card');

  beforeEach(() => {
    state = stateFake();
    canWrite = signal(false);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BlogStateService, useValue: state },
        { provide: AuthStore, useValue: { canWrite } },
      ],
    });
  });

  it('should create the page and ask the store to load the entries once', async () => {
    await render();

    expect(fixture.componentInstance).toBeTruthy();
    expect(state.loadBlogs).toHaveBeenCalledTimes(1);
    expect(text('h1')).toBe('Aktuelle Beiträge');
  });

  describe('entries', () => {
    it('renders one card per entry, in the order the store delivers them', async () => {
      state.filteredBlogs.set([
        blog({ id: 1, title: 'Eins' }),
        blog({ id: 2, title: 'Zwei' }),
        blog({ id: 3, title: 'Drei' }),
      ]);
      state.blogCount.set(3);

      await render();

      expect(cards()).toHaveLength(3);
      const titles = [...host.querySelectorAll('.blog-card__title-link')].map((a) =>
        a.textContent?.trim(),
      );
      expect(titles).toEqual(['Eins', 'Zwei', 'Drei']);
    });

    it('shows title and summary on every card', async () => {
      state.filteredBlogs.set([
        blog({ id: 1, title: 'Eins', contentPreview: 'Zusammenfassung eins' }),
        blog({ id: 2, title: 'Zwei', contentPreview: 'Zusammenfassung zwei' }),
      ]);
      state.blogCount.set(2);

      await render();

      const previews = [...host.querySelectorAll('.blog-card__preview')].map((p) =>
        p.textContent?.trim(),
      );
      expect(previews).toEqual(['Zusammenfassung eins', 'Zusammenfassung zwei']);
    });

    it('says how many of the total are shown', async () => {
      state.filteredBlogs.set([blog({ id: 1 })]);
      state.blogCount.set(3);

      await render();

      expect(text('.blog-list__count')).toBe('1 von 3 Beiträgen');
    });

    it('updates the page when the store changes', async () => {
      state.filteredBlogs.set([blog({ id: 1 })]);
      state.blogCount.set(1);
      await render();
      expect(cards()).toHaveLength(1);

      state.filteredBlogs.set([blog({ id: 1 }), blog({ id: 2 })]);
      state.blogCount.set(2);
      await fixture.whenStable();

      expect(cards()).toHaveLength(2);
    });
  });

  describe('states', () => {
    it('shows a spinner instead of cards while loading', async () => {
      state.loading.set(true);

      await render();

      expect(host.querySelector('mat-spinner')).not.toBeNull();
      expect(text('.blog-list__loading')).toContain('Beiträge werden geladen');
      expect(cards()).toHaveLength(0);
    });

    it('says there are no posts yet when the store is empty', async () => {
      await render();

      expect(text('.blog-list__empty')).toBe('Noch keine Beiträge vorhanden.');
    });

    it('blames the filter, not the blog, when entries exist but none match', async () => {
      state.blogCount.set(2);
      state.filteredBlogs.set([]);

      await render();

      expect(text('.blog-list__empty')).toBe('Keine Beiträge von diesem Autor.');
    });

    it('tells the user when it is showing the bundled sample data', async () => {
      state.offline.set(true);
      state.filteredBlogs.set([blog()]);
      state.blogCount.set(1);

      await render();

      const notice = host.querySelector('.blog-list__notice');
      expect(notice?.getAttribute('role')).toBe('status');
      expect(notice?.textContent).toContain('Backend nicht erreichbar');
    });

    it('stays quiet about the backend while it is reachable', async () => {
      await render();

      expect(host.querySelector('.blog-list__notice')).toBeNull();
      expect(host.querySelector('.blog-list__error')).toBeNull();
    });

    it('announces an error and lets the user try again', async () => {
      state.error.set('Beiträge konnten nicht geladen werden.');
      await render();

      const banner = host.querySelector('.blog-list__error');
      expect(banner?.getAttribute('role')).toBe('alert');
      expect(banner?.textContent).toContain('Beiträge konnten nicht geladen werden.');
      expect(state.loadBlogs).toHaveBeenCalledTimes(1);

      host.querySelector<HTMLButtonElement>('.blog-list__error button')?.click();

      expect(state.loadBlogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('interaction', () => {
    it('forwards a like from a card to the store', async () => {
      state.filteredBlogs.set([blog({ id: 1 }), blog({ id: 2 })]);
      state.blogCount.set(2);
      await render();

      const secondCard = cards()[1];
      secondCard.querySelector<HTMLButtonElement>('.blog-card__like-button')?.click();

      expect(state.toggleLike).toHaveBeenCalledTimes(1);
      expect(state.toggleLike).toHaveBeenCalledWith(2);
    });

    it('passes the chosen author on to the store', async () => {
      state.authors.set(['Jonas Müller', 'Maria Keller']);
      await render();

      const select = fixture.debugElement.query(By.directive(MatSelect))
        .componentInstance as MatSelect;
      select.valueChange.emit('Maria Keller');

      expect(state.setAuthor).toHaveBeenCalledWith('Maria Keller');
    });

    it('offers the create action only to users who may write', async () => {
      await render();
      expect(host.querySelector('.blog-list__new')).toBeNull();

      canWrite.set(true);
      await fixture.whenStable();

      expect(host.querySelector('.blog-list__new')).not.toBeNull();
    });
  });
});

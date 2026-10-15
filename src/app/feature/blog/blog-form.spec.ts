import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Blog } from './blog-model';
import { BlogForm } from './blog-form';
import { BlogStateService } from './blog-state-service';

function blog(overrides: Partial<Blog> = {}): Blog {
  return {
    id: 5,
    title: 'Bestehender Beitrag',
    contentPreview: 'Ein ausreichend langer Vorschautext.',
    author: 'Maria Keller',
    likes: 0,
    comments: 0,
    likedByMe: false,
    createdByMe: true,
    createdAt: '2026-02-15T10:30:00',
    updatedAt: '2026-02-15T10:30:00',
    ...overrides,
  };
}

/**
 * The route decides create-vs-edit, and an edit route that cannot produce a
 * usable id must fail rather than quietly create something new.
 */
describe('BlogForm route mode', () => {
  let state: {
    createBlog: ReturnType<typeof vi.fn>;
    updateBlog: ReturnType<typeof vi.fn>;
    loadBlogs: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    blogs: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    clearError: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<BlogForm>;
  let host: HTMLElement;

  async function render(inputs: { mode?: 'create' | 'edit'; id?: string }): Promise<void> {
    state = {
      createBlog: vi.fn().mockResolvedValue(blog({ id: 99 })),
      updateBlog: vi.fn().mockResolvedValue(blog()),
      loadBlogs: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockReturnValue(blog()),
      blogs: vi.fn().mockReturnValue([blog()]),
      error: vi.fn().mockReturnValue(null),
      clearError: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: BlogStateService, useValue: state },
      ],
    });

    fixture = TestBed.createComponent(BlogForm);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    if (inputs.mode) fixture.componentRef.setInput('mode', inputs.mode);
    if (inputs.id !== undefined) fixture.componentRef.setInput('id', inputs.id);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  /** Fills the reactive form so submitting is not blocked by validation. */
  async function fillAndSubmit(): Promise<void> {
    const set = (name: string, value: string) => {
      const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[formcontrolname="${name}"]`,
      );
      if (!field) throw new Error(`missing field ${name}`);
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };

    set('title', 'Ein Titel');
    set('author', 'Nuri');
    set('contentPreview', 'Ein ausreichend langer Inhalt für die Vorschau.');
    await fixture.whenStable();

    host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();
  }

  it('creates on the create route', async () => {
    await render({ mode: 'create' });
    await fillAndSubmit();

    expect(state.createBlog).toHaveBeenCalled();
    expect(state.updateBlog).not.toHaveBeenCalled();
  });

  it('updates on the edit route', async () => {
    await render({ mode: 'edit', id: '5' });
    await fillAndSubmit();

    expect(state.updateBlog).toHaveBeenCalledWith(5, expect.anything());
    expect(state.createBlog).not.toHaveBeenCalled();
  });

  // '?id=' used to bind straight into the id input, because /blogs/new has no
  // ':id' route parameter to take precedence over a query parameter.
  it('stays in create mode even when an id is bound from the query string', async () => {
    await render({ mode: 'create', id: '5' });
    await fillAndSubmit();

    expect(state.createBlog).toHaveBeenCalled();
    expect(state.updateBlog).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-1', '2.5', ''])(
    'refuses to save an edit route whose id is unusable: %s',
    async (id) => {
      await render({ mode: 'edit', id });
      await fillAndSubmit();

      expect(state.updateBlog).not.toHaveBeenCalled();
      // The dangerous outcome is not "nothing happens" but "a new entry appears".
      expect(state.createBlog).not.toHaveBeenCalled();
      expect(host.textContent).toContain('konnte nicht geladen werden');
    },
  );
});

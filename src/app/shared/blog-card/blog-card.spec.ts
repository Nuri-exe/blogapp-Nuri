import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Blog } from '../../feature/blog/blog-model';
import { BlogCard } from './blog-card';

function blog(overrides: Partial<Blog> = {}): Blog {
  return {
    id: 7,
    title: 'Signals in der Praxis',
    contentPreview: 'Wie computed() und effect() zusammenspielen.',
    author: 'Maria Keller',
    likes: 12,
    comments: 4,
    likedByMe: false,
    createdByMe: false,
    headerImageUrl: 'https://example.test/header.png',
    createdAt: '2026-02-15T10:30:00',
    updatedAt: '2026-02-16T08:15:00',
    ...overrides,
  };
}

/**
 * BlogCard is a presentational component: data comes in through a signal input,
 * the only thing that goes out is the `like` output. The tests keep to exactly
 * that contract and never reach into the store.
 */
describe('BlogCard', () => {
  let fixture: ComponentFixture<BlogCard>;
  let host: HTMLElement;

  /** Signal inputs are set through `componentRef.setInput()`, not by assignment. */
  async function render(overrides: Partial<Blog> = {}): Promise<void> {
    fixture = TestBed.createComponent(BlogCard);
    fixture.componentRef.setInput('blog', blog(overrides));
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const text = (selector: string) => host.querySelector(selector)?.textContent?.trim();
  const likeButton = () => host.querySelector<HTMLButtonElement>('.blog-card__like-button');

  beforeEach(() => {
    // RouterLink needs a router to resolve '/blogs/7' into an href; the card
    // itself never navigates, so an empty route table is enough.
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('should create the component', async () => {
    await render();

    expect(fixture.componentInstance).toBeTruthy();
    expect(host.querySelector('mat-card.blog-card')).not.toBeNull();
  });

  describe('content', () => {
    it('displays the title as a link to the detail page', async () => {
      await render({ id: 7, title: 'Signals in der Praxis' });

      const link = host.querySelector<HTMLAnchorElement>('.blog-card__title-link');
      expect(link?.textContent?.trim()).toBe('Signals in der Praxis');
      expect(link?.getAttribute('href')).toBe('/blogs/7');
    });

    it('displays the content preview', async () => {
      await render({ contentPreview: 'Wie computed() und effect() zusammenspielen.' });

      expect(text('.blog-card__preview')).toBe('Wie computed() und effect() zusammenspielen.');
    });

    it('displays author and creation date in the configured format', async () => {
      await render({ author: 'Maria Keller', createdAt: '2026-02-15T10:30:00' });

      // 'd. MMM yyyy' in the default (en-US) locale — the same one the app runs in.
      expect(text('.blog-card__subtitle')).toMatch(/^Maria Keller\s*·\s*15\. Feb 2026$/);
    });

    it('displays the like and comment counts', async () => {
      await render({ likes: 12, comments: 4 });

      const metrics = [...host.querySelectorAll('.blog-card__metric')].map((m) =>
        m.textContent?.replace(/\s+/g, ' ').trim(),
      );
      // The comment metric also carries its icon's ligature name.
      expect(metrics[0]).toBe('12');
      expect(metrics[1]).toContain('4');
    });

    it('updates when the input changes', async () => {
      await render({ title: 'Erster Titel' });

      fixture.componentRef.setInput('blog', blog({ title: 'Zweiter Titel' }));
      await fixture.whenStable();

      expect(text('.blog-card__title-link')).toBe('Zweiter Titel');
    });
  });

  describe('header image', () => {
    it('shows the image with the title as its alternative text', async () => {
      await render({ title: 'Mit Bild', headerImageUrl: 'https://example.test/header.png' });

      const image = host.querySelector<HTMLImageElement>('img.blog-card__image');
      expect(image?.getAttribute('src')).toBe('https://example.test/header.png');
      expect(image?.getAttribute('alt')).toBe('Mit Bild');
    });

    it('renders no image element at all when the entry has none', async () => {
      await render({ headerImageUrl: undefined });

      expect(host.querySelector('img')).toBeNull();
    });
  });

  describe('like button', () => {
    it('emits the id of the entry when clicked', async () => {
      await render({ id: 7 });
      const liked = vi.fn();
      fixture.componentInstance.like.subscribe(liked);

      likeButton()?.click();

      expect(liked).toHaveBeenCalledTimes(1);
      expect(liked).toHaveBeenCalledWith(7);
    });

    it('does not change its own count — the parent owns the state', async () => {
      await render({ likes: 12 });

      likeButton()?.click();
      await fixture.whenStable();

      expect(text('.blog-card__metric')).toBe('12');
    });

    it('offers to like an entry that is not liked yet', async () => {
      await render({ likedByMe: false });

      const button = likeButton();
      expect(button?.getAttribute('aria-label')).toBe('Beitrag liken');
      expect(button?.getAttribute('aria-pressed')).toBe('false');
      expect(button?.classList).not.toContain('is-liked');
      expect(button?.textContent?.trim()).toBe('favorite_border');
    });

    it('offers to take the like back once it is set', async () => {
      await render({ likedByMe: true });

      const button = likeButton();
      expect(button?.getAttribute('aria-label')).toBe('Like entfernen');
      expect(button?.getAttribute('aria-pressed')).toBe('true');
      expect(button?.classList).toContain('is-liked');
      expect(button?.textContent?.trim()).toBe('favorite');
    });
  });

  describe('ownership chip', () => {
    it('marks entries written by the current user', async () => {
      await render({ createdByMe: true });

      expect(text('.blog-card__chip')).toBe('Mein Beitrag');
    });

    it('stays away from entries written by someone else', async () => {
      await render({ createdByMe: false });

      expect(host.querySelector('.blog-card__chip')).toBeNull();
    });
  });

  describe('untrusted text', () => {
    // Titles come from a backend anyone can write to. Interpolation escapes
    // them; this pins that down so nobody "fixes" it into [innerHTML] later.
    it('renders markup in the title as plain text instead of creating elements', async () => {
      const hostile = '<img src="x" onerror="alert(1)"><b>fett</b>';
      await render({ title: hostile, headerImageUrl: undefined });

      const link = host.querySelector('.blog-card__title-link');
      expect(link?.textContent?.trim()).toBe(hostile);
      expect(link?.querySelector('img, b')).toBeNull();
      expect(host.querySelector('img')).toBeNull();
    });
  });
});

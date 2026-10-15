import type { Page } from '@playwright/test';

import { ENTRIES, expect, test } from './fixtures';

/**
 * Acceptance criteria for the blog overview (`/blogs`):
 *
 *  AK1  Every entry the backend delivers appears as one card, in the order it
 *       was delivered, and the page says how many there are.
 *  AK2  Each card shows the entry's title — as a link to its detail page — and
 *       its summary.
 *  AK3  Choosing an author shows only that author's entries and the count says
 *       "x von y"; "Alle Autoren" brings the rest back; the choice survives a
 *       reload.
 *
 * Every test starts from `ENTRIES` (see fixtures.ts): the same four entries,
 * three authors, no matter what the real backend currently holds.
 */
test.describe('Blog overview', () => {
  const total = ENTRIES.length;

  test.beforeEach(async ({ page }) => {
    await page.goto('/blogs');
  });

  test('AK1: shows one card per entry, in the delivered order', async ({ page }) => {
    // toHaveCount waits for the cards and fails on zero — unlike a loop over
    // whatever happens to be on the page, it cannot pass on an empty list.
    await expect(page.locator('app-blog-card')).toHaveCount(total);
    await expect(page.locator('app-blog-card .blog-card__title-link')).toHaveText(
      ENTRIES.map((entry) => entry.title),
    );
    await expect(page.locator('.blog-list__count')).toHaveText(`${total} von ${total} Beiträgen`);
  });

  test('AK2: every card shows its title as a link and its summary', async ({ page }) => {
    await expect(page.locator('app-blog-card')).toHaveCount(total);

    for (const entry of ENTRIES) {
      const card = page.locator('app-blog-card', { hasText: entry.title });

      const link = card.getByRole('link', { name: entry.title });
      await expect(link).toHaveAttribute('href', `/blogs/${entry.id}`);
      await expect(card.locator('.blog-card__preview')).toHaveText(entry.contentPreview);
      await expect(card.locator('.blog-card__subtitle')).toContainText(entry.author);
    }
  });

  test.describe('AK3: author filter', () => {
    const marias = ENTRIES.filter((entry) => entry.author === 'Maria Keller');

    // The filter is a mat-select: its options live in an overlay, outside the
    // component, and are only in the DOM while the panel is open.
    async function choose(page: Page, author: string) {
      await page.getByRole('combobox', { name: 'Autor' }).click();
      await page.getByRole('option', { name: author }).click();
      // The panel animates out; opening it again before it is gone clicks a
      // detached option.
      await expect(page.getByRole('listbox')).toHaveCount(0);
    }

    test('lists the authors once each, after "Alle Autoren"', async ({ page }) => {
      await page.getByRole('combobox', { name: 'Autor' }).click();

      await expect(page.getByRole('option')).toHaveText([
        'Alle Autoren',
        'Jonas Müller',
        'Maria Keller',
        'Sarah Brunner',
      ]);
    });

    test('narrows the cards and the count to the chosen author', async ({ page }) => {
      await expect(page.locator('app-blog-card')).toHaveCount(total);

      await choose(page, 'Maria Keller');

      await expect(page.locator('app-blog-card .blog-card__title-link')).toHaveText(
        marias.map((entry) => entry.title),
      );
      // Not just "fewer cards": every remaining card is hers.
      await expect(page.locator('app-blog-card .blog-card__subtitle')).toHaveText([
        /^\s*Maria Keller/,
        /^\s*Maria Keller/,
      ]);
      await expect(page.locator('.blog-list__count')).toHaveText(
        `${marias.length} von ${total} Beiträgen`,
      );
    });

    test('"Alle Autoren" brings the full list back', async ({ page }) => {
      await choose(page, 'Jonas Müller');
      await expect(page.locator('app-blog-card')).toHaveCount(1);

      await choose(page, 'Alle Autoren');

      await expect(page.locator('app-blog-card')).toHaveCount(total);
      await expect(page.locator('.blog-list__count')).toHaveText(`${total} von ${total} Beiträgen`);
    });

    test('is still applied after a reload', async ({ page }) => {
      await choose(page, 'Maria Keller');
      await expect(page.locator('app-blog-card')).toHaveCount(marias.length);

      await page.reload();

      await expect(page.getByRole('combobox', { name: 'Autor' })).toContainText('Maria Keller');
      await expect(page.locator('app-blog-card')).toHaveCount(marias.length);
    });
  });

  test.describe('when the author has no entries any more', () => {
    test('says so, instead of claiming the blog is empty', async ({ page, backend }) => {
      // Stored choice from an earlier visit; the author has since been removed.
      await page.evaluate(() => localStorage.setItem('blogapp.selectedAuthor', 'Verschwunden'));
      backend.serve(ENTRIES);

      await page.reload();

      await expect(page.locator('.blog-list__empty')).toHaveText(
        'Keine Beiträge von diesem Autor.',
      );
      await expect(page.locator('.blog-list__count')).toHaveText(`0 von ${total} Beiträgen`);
    });
  });
});

test.describe('Blog overview without entries', () => {
  test.use({ entries: [] });

  test('says there are no posts yet', async ({ page }) => {
    await page.goto('/blogs');

    await expect(page.locator('.blog-list__empty')).toHaveText('Noch keine Beiträge vorhanden.');
    await expect(page.locator('app-blog-card')).toHaveCount(0);
    await expect(page.locator('.blog-list__count')).toHaveText('0 von 0 Beiträgen');
  });
});

test.describe('Blog overview when the backend is down', () => {
  test('falls back to the bundled sample data and says so', async ({ page, backend }) => {
    backend.goDown();

    await page.goto('/blogs');

    await expect(
      page.getByRole('status').filter({ hasText: 'Backend nicht erreichbar' }),
    ).toBeVisible();
    // The sample file holds six entries; none of them is one of ours.
    await expect(page.locator('app-blog-card')).toHaveCount(6);
    await expect(page.getByText(ENTRIES[0].title)).toHaveCount(0);
  });

  test('shows an error and recovers on retry when the sample data fails too', async ({
    page,
    backend,
  }) => {
    backend.goDown();
    await page.route('**/data/blogs.json', (route) => route.abort('connectionrefused'));

    await page.goto('/blogs');

    await expect(page.getByRole('alert')).toContainText('Beiträge konnten nicht geladen werden.');
    await expect(page.locator('app-blog-card')).toHaveCount(0);

    backend.serve(ENTRIES);
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();

    await expect(page.locator('app-blog-card')).toHaveCount(ENTRIES.length);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

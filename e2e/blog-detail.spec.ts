import { ENTRIES, expect, test } from './fixtures';

/**
 * The detail page (`/blogs/:id`) — the second page of the suite.
 *
 * It is the place where the app's shared state shows: the overview and the
 * detail page read one store, so what happens on the first must be visible on
 * the second without another request.
 */
test.describe('Blog detail page', () => {
  const [first, second] = ENTRIES;

  test('opens from the overview and shows the whole entry', async ({ page }) => {
    await page.goto('/blogs');

    await page.getByRole('link', { name: second.title }).click();

    await expect(page).toHaveURL(`/blogs/${second.id}`);
    await expect(page.locator('.blog-detail__title')).toHaveText(second.title);
    await expect(page.locator('.blog-detail__subtitle')).toContainText(second.author);
    await expect(page.locator('.blog-detail__subtitle')).toContainText('2026');
    await expect(page.locator('.blog-detail__content')).toHaveText(second.contentPreview);
    await expect(page.locator('.blog-detail__like-button')).toContainText(`${second.likes} Likes`);
    await expect(page.locator('.blog-detail__metric')).toContainText(
      `${second.comments} Kommentare`,
    );
  });

  test('loads the entry on a direct visit, without going through the overview', async ({
    page,
  }) => {
    // The resolver has to fetch the list itself: the store is empty here.
    await page.goto(`/blogs/${first.id}`);

    await expect(page.locator('.blog-detail__title')).toHaveText(first.title);
  });

  test('goes back to the overview with the full list', async ({ page }) => {
    await page.goto(`/blogs/${first.id}`);
    await expect(page.locator('.blog-detail__title')).toBeVisible();

    await page.getByRole('link', { name: 'Zurück zur Übersicht' }).click();

    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.locator('app-blog-card')).toHaveCount(ENTRIES.length);
  });

  test('tells the visitor when the entry does not exist', async ({ page }) => {
    await page.goto('/blogs/9999');

    await expect(page.getByRole('heading', { name: 'Beitrag nicht gefunden' })).toBeVisible();
    await expect(page.locator('.blog-detail__title')).toHaveCount(0);
    // A way out must remain.
    await expect(page.getByRole('link', { name: 'Zurück zur Übersicht' })).toBeVisible();
  });

  test.describe('likes', () => {
    test('a like on the detail page raises the count and can be taken back', async ({ page }) => {
      await page.goto(`/blogs/${second.id}`);
      const like = page.locator('.blog-detail__like-button');
      await expect(like).toContainText(`${second.likes} Likes`);

      await like.click();
      await expect(like).toContainText(`${second.likes + 1} Likes`);

      await like.click();
      await expect(like).toContainText(`${second.likes} Likes`);
    });

    test('a like given on the overview is still there on the detail page', async ({ page }) => {
      await page.goto('/blogs');
      const card = page.locator('app-blog-card', { hasText: first.title });
      const heart = card.getByRole('button', { name: 'Beitrag liken' });

      await heart.click();
      await expect(card.getByRole('button', { name: 'Like entfernen' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await card.getByRole('link', { name: first.title }).click();

      await expect(page.locator('.blog-detail__like-button')).toContainText(
        `${first.likes + 1} Likes`,
      );
    });
  });

  test('offers no editing without an auth backend', async ({ page }) => {
    // The production bundle ships with authEnabled = false.
    await page.goto(`/blogs/${first.id}`);
    await expect(page.locator('.blog-detail__title')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
  });
});

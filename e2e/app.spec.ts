import { test, expect } from '@playwright/test';

test.describe('HFTM Blog app', () => {
  test('shows the blog overview by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('mat-toolbar')).toContainText('HFTM Blog');
    await expect(page.locator('h1')).toContainText('Aktuelle Beiträge');
    await expect(page.locator('app-blog-card').first()).toBeVisible();
  });

  test('navigates to the about page from the header', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Über' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator('h1, mat-card-title').first()).toContainText(/Über/i);
  });

  test('exposes a theme toggle button in the header', async ({ page }) => {
    await page.goto('/');

    const toggle = page.locator('.app-header__theme-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', /true|false/);
  });

  test('opens the create form and validates required fields', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Neuer Beitrag' }).click();
    await expect(page).toHaveURL(/\/blogs\/new$/);
    await expect(page.locator('mat-card-title')).toContainText('Neuer Beitrag');

    // Submitting an empty form must not navigate away; the required errors show up.
    await page.getByRole('button', { name: 'Beitrag erstellen' }).click();
    await expect(page).toHaveURL(/\/blogs\/new$/);
    await expect(page.locator('mat-error').first()).toBeVisible();
  });

  test('filters the overview by author and remembers the choice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-blog-card').first()).toBeVisible();

    await page.locator('.blog-list__filter').click();
    const firstAuthorOption = page.getByRole('option').nth(1);
    const author = (await firstAuthorOption.textContent())?.trim() ?? '';
    await firstAuthorOption.click();

    // Every remaining card must belong to the selected author.
    const subtitles = page.locator('app-blog-card .blog-card__subtitle');
    await expect(subtitles.first()).toBeVisible();
    for (let i = 0; i < (await subtitles.count()); i++) {
      await expect(subtitles.nth(i)).toContainText(author);
    }

    // The effect writes the filter to localStorage, so a reload keeps it.
    await page.reload();
    await expect(page.locator('.blog-list__filter')).toContainText(author);
  });

  test('opens a blog entry from the overview', async ({ page }) => {
    await page.goto('/');

    const firstTitle = page.locator('app-blog-card .blog-card__title-link').first();
    const title = (await firstTitle.textContent())?.trim() ?? '';
    await firstTitle.click();

    await expect(page).toHaveURL(/\/blogs\/\d+$/);
    await expect(page.locator('.blog-detail__title')).toContainText(title);
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toBeVisible();
  });

  test('prefills the edit form from the store', async ({ page }) => {
    await page.goto('/');

    const firstTitle = page.locator('app-blog-card .blog-card__title-link').first();
    const title = (await firstTitle.textContent())?.trim() ?? '';
    await firstTitle.click();
    await expect(page).toHaveURL(/\/blogs\/\d+$/);

    await page.getByRole('link', { name: 'Bearbeiten' }).click();
    await expect(page).toHaveURL(/\/blogs\/\d+\/edit$/);
    await expect(page.locator('mat-card-title')).toContainText('Beitrag bearbeiten');
    await expect(page.locator('input[formcontrolname="title"]')).toHaveValue(title);
  });
});

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
});

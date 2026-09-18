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

  test('validates the signal form before it allows a submit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Schreiben' }).click();
    await expect(page).toHaveURL(/\/blogs\/create$/);

    const submit = page.getByRole('button', { name: 'Beitrag veröffentlichen' });
    await expect(submit).toBeDisabled();

    // The button is disabled from the start, so the reason has to be on screen
    // without the user touching anything first.
    await expect(page.locator('.blog-create__pending')).toContainText('Titel ist erforderlich.');

    // Errors on a field only appear once it was left.
    const title = page.locator('#blog-title');
    await title.fill('Hallo! Welt?');
    await title.blur();
    await expect(page.locator('#blog-title-errors')).toContainText('Nur Buchstaben');

    await title.fill('Mein erster Beitrag');
    await expect(page.locator('#blog-title-errors')).toHaveCount(0);

    // Content shorter than twice the title keeps the form invalid.
    const content = page.locator('#blog-content');
    await content.fill('Viel zu kurz.');
    await content.blur();
    await expect(page.locator('#blog-content-errors')).toContainText('doppelt so lang');
    await expect(submit).toBeDisabled();

    await content.fill('Ein Inhalt, der locker doppelt so lang ist wie der Titel dieses Beitrags.');
    await expect(page.locator('#blog-content-errors')).toHaveCount(0);
    await expect(page.locator('.blog-create__pending')).toHaveCount(0);
    await expect(submit).toBeEnabled();
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
  });

  // This build ships with environment.authEnabled = false, because the static
  // hosting target cannot run the BFF. The guard must therefore keep the
  // write routes out of reach and the UI must not advertise them.
  test('keeps the write routes out of reach without a usable auth backend', async ({ page }) => {
    await page.goto('/blogs/new');
    await expect(page).toHaveURL(/\/blogs$/);

    await page.goto('/blogs/1/edit');
    await expect(page).toHaveURL(/\/blogs$/);

    await expect(page.locator('.blog-list__new')).toHaveCount(0);
    await expect(page.locator('[data-testid="login"]')).toHaveCount(0);
  });

  test('renders the login page and its error from the query string', async ({ page }) => {
    await page.goto('/login?error=access_denied');

    await expect(page.locator('mat-card-title')).toContainText('Anmelden');
    await expect(page.locator('[data-testid="login-error"]')).toContainText('abgebrochen');

    // No form: the password is only ever typed on Keycloak's own page.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});

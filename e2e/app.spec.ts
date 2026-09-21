import { Page, test, expect } from '@playwright/test';

/**
 * Distinct left edges of the blog cards = number of columns the grid renders.
 * Needs at least three cards, which the bundled fallback data guarantees even
 * when the API is unreachable.
 */
async function columnCount(page: Page): Promise<number> {
  const cards = page.locator('app-blog-card');
  await expect(cards.nth(2)).toBeVisible();
  const lefts = await cards.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().left)),
  );
  return new Set(lefts).size;
}

/**
 * Chromium reports a blocked resource as a console error, and the DOM fires a
 * securitypolicyviolation event; the init script turns the latter into a
 * console error too so both surface in one list. Only CSP messages count —
 * an unreachable backend logs its own errors and is not what this checks.
 */
function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && /Content Security Policy|CSP violation/.test(text)) {
      violations.push(text);
    }
  });
  return violations;
}

const cspProbe = () => {
  document.addEventListener('securitypolicyviolation', (event) => {
    console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`);
  });
};

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

  test('keeps the links in the toolbar and the drawer closed on desktop', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.app-header__nav')).toBeVisible();
    await expect(page.locator('[data-testid="menu-toggle"]')).toHaveCount(0);
    await expect(page.locator('mat-sidenav')).toBeHidden();
  });

  test('lays the cards out in three columns on desktop', async ({ page }) => {
    await page.goto('/');

    expect(await columnCount(page)).toBe(3);
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
  // hosting target cannot run the BFF. Every write route — including the
  // Signal Forms page from Kurstag 10, whose behaviour its 17 unit tests
  // cover — must therefore stay out of reach, and the UI must not advertise it.
  test('keeps the write routes out of reach without a usable auth backend', async ({ page }) => {
    for (const route of ['/blogs/new', '/blogs/create', '/blogs/1/edit']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/blogs$/);
    }

    await expect(page.locator('.blog-list__new')).toHaveCount(0);
    await expect(page.locator('.blog-list__compose')).toHaveCount(0);
    await expect(page.locator('[data-testid="login"]')).toHaveCount(0);
  });

  test('renders the login page and its error from the query string', async ({ page }) => {
    await page.goto('/login?error=access_denied');

    await expect(page.locator('mat-card-title')).toContainText('Anmelden');
    await expect(page.locator('[data-testid="login-error"]')).toContainText('abgebrochen');

    // No form: the password is only ever typed on Keycloak's own page.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('runs under the Content Security Policy without a single violation', async ({ page }) => {
    const violations = collectCspViolations(page);
    await page.addInitScript(cspProbe);

    // Overview (API call, cards, Material widgets), a detail page (header image
    // from a foreign https host), and the login page.
    await page.goto('/');
    await expect(page.locator('app-blog-card').first()).toBeVisible();
    await page.locator('app-blog-card .blog-card__title-link').first().click();
    await expect(page.locator('.blog-detail__title')).toBeVisible();
    await page.goto('/login?error=access_denied');
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();

    expect(violations).toEqual([]);
  });

  test('serves the icon and text fonts from its own origin', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('mat-icon').first()).toBeVisible();

    // The ligature font has to be loaded, otherwise every <mat-icon> shows its
    // name as plain text ("menu", "dark_mode", …).
    const iconFontReady = await page.evaluate(async () => {
      await document.fonts.load('24px "Material Icons"');
      return document.fonts.check('24px "Material Icons"');
    });
    expect(iconFontReady).toBe(true);

    const origin = new URL(page.url()).origin;
    const fontRequests = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => /material-icons|roboto/i.test(name)),
    );
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const request of fontRequests) {
      expect(request.startsWith(origin)).toBe(true);
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('stacks the cards in a single column', async ({ page }) => {
    await page.goto('/');

    expect(await columnCount(page)).toBe(1);
  });

  test('moves the navigation into a drawer behind the hamburger', async ({ page }) => {
    await page.goto('/');

    // Toolbar links are gone, the hamburger is there, the drawer is closed.
    await expect(page.locator('.app-header__nav')).toBeHidden();
    const menu = page.locator('[data-testid="menu-toggle"]');
    await expect(menu).toBeVisible();
    await expect(page.locator('mat-sidenav')).toBeHidden();

    await menu.click();
    const drawer = page.locator('mat-sidenav');
    await expect(drawer).toBeVisible();

    // The links stack vertically: same left edge, increasing top edge.
    const links = drawer.locator('.shell__nav a');
    await expect(links).toHaveCount(2);
    const boxes = await links.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: Math.round(rect.left), top: Math.round(rect.top) };
      }),
    );
    expect(boxes[0].left).toBe(boxes[1].left);
    expect(boxes[1].top).toBeGreaterThan(boxes[0].top);

    // Choosing a link navigates and closes the drawer again.
    await drawer.getByRole('link', { name: 'Über' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(drawer).toBeHidden();
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 800, height: 1100 } });

  test('lays the cards out in two columns', async ({ page }) => {
    await page.goto('/');

    expect(await columnCount(page)).toBe(2);
  });

  test('keeps the links in the toolbar', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.app-header__nav')).toBeVisible();
    await expect(page.locator('[data-testid="menu-toggle"]')).toHaveCount(0);
  });
});

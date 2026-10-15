import { expect, test as base } from '@playwright/test';

/** One entry the way the backend sends it (see `blog-schema.ts`). */
export interface Entry {
  id: number;
  title: string;
  contentPreview: string;
  author: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdByMe: boolean;
  headerImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The data every test starts from. Ids start at 101 so they cannot be mixed up
 * with the six entries in `public/data/blogs.json`, which the app falls back to
 * when the backend is down — a test that reads sample data by accident fails
 * on the ids instead of passing by luck.
 *
 * Titles are unique and none contains another, so `hasText` finds one card.
 */
export const ENTRIES: readonly Entry[] = [
  entry(101, 'Signals im Alltag', 'Maria Keller', 'Wie computed() und effect() zusammenspielen.', {
    likes: 12,
    comments: 4,
  }),
  entry(102, 'Vitest statt Karma', 'Jonas Müller', 'Der Umstieg auf den neuen Test-Runner.', {
    likes: 3,
    comments: 0,
  }),
  entry(103, 'Playwright in der CI', 'Maria Keller', 'End-to-End-Tests ohne Flackern.', {
    likes: 7,
    comments: 2,
  }),
  entry(104, 'Zoneless ist da', 'Sarah Brunner', 'Change Detection ohne zone.js.', {
    likes: 0,
    comments: 1,
  }),
];

function entry(
  id: number,
  title: string,
  author: string,
  contentPreview: string,
  overrides: Partial<Entry> = {},
): Entry {
  return {
    id,
    title,
    contentPreview,
    author,
    likes: 0,
    comments: 0,
    likedByMe: false,
    createdByMe: false,
    headerImageUrl: null,
    createdAt: '2026-03-01T09:00:00',
    updatedAt: '2026-03-02T09:00:00',
    ...overrides,
  };
}

// The production bundle runs on localhost:4200 and calls another origin, so a
// stubbed answer needs the header the real server would send.
const CORS = { 'access-control-allow-origin': '*' };

export interface Backend {
  /** Replaces what `GET /entries` answers with. Brings a downed backend back up. */
  serve(entries: readonly Entry[]): void;
  /** Makes `GET /entries` fail the way an unreachable server does. */
  goDown(): void;
  /** Writes the app tried to send; the stub refuses them all (see below). */
  readonly blockedWrites: readonly string[];
}

interface Fixtures {
  /** What the stubbed backend serves at the start; override with `test.use`. */
  entries: readonly Entry[];
  backend: Backend;
}

/**
 * `test` with a stubbed backend, switched on for every test.
 *
 * The production bundle talks to a shared teacher backend whose content changes
 * and which may be down during CI. A test that depends on it passes or fails
 * for reasons that have nothing to do with the app. Here the request never
 * leaves the browser: the answer is exactly what the test declared.
 */
export const test = base.extend<Fixtures>({
  entries: [ENTRIES, { option: true }],

  backend: [
    async ({ page, entries }, use) => {
      let current: readonly Entry[] | 'down' = entries;
      const writes: string[] = [];

      // Matches both `https://<azure>/entries` (production bundle) and
      // `/api/entries` (development proxy), with or without an id and query.
      await page.route(/\/entries(\/\d+)?(\?.*)?$/, async (route) => {
        const request = route.request();

        // A test must never be able to change data on the real backend, even
        // by accident. Every write is answered here and recorded.
        if (request.method() !== 'GET') {
          writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
          return route.fulfill({ status: 501, headers: CORS, body: '' });
        }

        if (current === 'down') return route.abort('connectionrefused');

        // The real endpoint answers with a paginated envelope.
        return route.fulfill({
          status: 200,
          headers: CORS,
          json: { data: current, pageIndex: 0, totalCount: current.length },
        });
      });

      // The images in the bundled sample data live on unsplash. Nothing here
      // asserts on them, and a slow third party must not slow the suite down.
      await page.route(/images\.unsplash\.com/, (route) => route.abort());

      await use({
        serve: (next) => {
          current = next;
        },
        goDown: () => {
          current = 'down';
        },
        get blockedWrites() {
          return writes;
        },
      });

      // A test that wrote anything has found a path the suite did not intend.
      expect(writes, 'the app tried to write to the backend').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

import { z } from 'zod';

/**
 * Stop zod from probing whether `eval` is available.
 *
 * Without this, zod runs `new Function('')` once to decide whether it may
 * compile a faster validator. It catches the failure, so nothing breaks — but
 * the browser still counts the attempt as a `script-src` violation and
 * reports it, which under our CSP means a console error on every first
 * validation. `jitless` skips the probe and keeps the interpreted path.
 */
z.config({ jitless: true });

/**
 * Runtime validation for everything the backend hands us.
 *
 * This module is loaded lazily by `BlogService` (zod costs ~65 kB gzipped), so
 * import it with `await import('./blog-schema')` rather than statically.
 */

/**
 * Schema for a single entry.
 *
 * Only `id` and `title` are hard requirements — without them an entry can be
 * neither routed to nor rendered. Every other field falls back to a neutral
 * default, so a backend that renames or drops a field degrades a single card
 * instead of taking down the whole overview.
 *
 * Reached only through `await import('./blog-schema')` in BlogService, which
 * static analysis cannot follow — hence the fallow suppression below. A plain
 * import would pull zod into the initial bundle, the very thing this split
 * avoids.
 */
/**
 * A date string the `DatePipe` can actually render.
 *
 * Angular's `toDate()` throws RuntimeError 2311 for a non-empty string it
 * cannot parse, and that happens inside change detection — one malformed
 * `createdAt` from the backend would take down the whole overview. An empty
 * string is the pipe's own "render nothing" case, so that is the fallback.
 */
const isoDate = z
  .string()
  .default('')
  .transform((value) => (value && !Number.isNaN(Date.parse(value)) ? value : ''));

// fallow-ignore-next-line unused-export
export const blogSchema = z.object({
  id: z.number(),
  title: z.string(),
  contentPreview: z.string().default(''),
  author: z.string().default('Unbekannt'),
  likes: z.number().default(0),
  comments: z.number().default(0),
  likedByMe: z.boolean().default(false),
  createdByMe: z.boolean().default(false),
  // Only an https location is kept. An http image would be mixed content on
  // the deployed site, and anything without a scheme is not an image address
  // at all — the CSP (img-src) enforces the same rule in the browser, this
  // keeps the model honest one step earlier.
  headerImageUrl: z
    .string()
    .nullish()
    .transform((value) => (value && /^https:\/\//i.test(value) ? value : undefined)),
  createdAt: isoDate,
  updatedAt: isoDate,
});

/**
 * The list endpoint answers with a paginated envelope (`{ data, pageIndex, … }`),
 * while the local fallback file is a bare array. Accept both shapes and unwrap
 * to the raw item list; each item is then validated on its own.
 *
 * Same as `blogSchema` — loaded through the dynamic import in BlogService,
 * not a static one.
 */
// fallow-ignore-next-line unused-export
export const blogListPayloadSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()) }),
]);

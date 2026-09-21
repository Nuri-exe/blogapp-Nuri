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
 * @expected-unused Reached only through `await import('./blog-schema')` in
 * BlogService, which static analysis cannot follow. A plain import would pull
 * zod into the initial bundle — the very thing this split avoids.
 */
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
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
});

/**
 * The list endpoint answers with a paginated envelope (`{ data, pageIndex, … }`),
 * while the local fallback file is a bare array. Accept both shapes and unwrap
 * to the raw item list; each item is then validated on its own.
 *
 * @expected-unused Same as `blogSchema` — loaded through the dynamic import in
 * BlogService, not a static one.
 */
export const blogListPayloadSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()) }),
]);

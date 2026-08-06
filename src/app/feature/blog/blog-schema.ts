import { z } from 'zod';

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
  headerImageUrl: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
});

/**
 * The list endpoint answers with a paginated envelope (`{ data, pageIndex, … }`),
 * while the local fallback file is a bare array. Accept both shapes and unwrap
 * to the raw item list; each item is then validated on its own.
 */
export const blogListPayloadSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()) }),
]);

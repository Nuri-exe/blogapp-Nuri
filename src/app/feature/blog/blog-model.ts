/**
 * Types only — deliberately free of runtime imports.
 *
 * The matching zod schemas live in `blog-schema.ts`, which `BlogService` pulls
 * in via a dynamic import so zod stays out of the initial bundle.
 */

/** A blog entry as the app renders it — mirrors the backend's `EntryOverview`. */
export interface Blog {
  id: number;
  title: string;
  contentPreview: string;
  author: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdByMe: boolean;
  headerImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload sent to the backend when creating or updating an entry. */
export interface BlogInput {
  title: string;
  contentPreview: string;
  author: string;
  headerImageUrl?: string;
}

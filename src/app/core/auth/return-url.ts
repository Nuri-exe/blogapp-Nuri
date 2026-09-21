/** Where a sign-in lands when the caller did not say, or said something unsafe. */
export const DEFAULT_RETURN_URL = '/blogs';

const ORIGIN_PROBE = 'https://this-origin.invalid';

/**
 * Keeps a `returnUrl` on this site.
 *
 * The value arrives from the query string, so anyone can mail around a link
 * like `/login?returnUrl=https://evil.example`: the victim signs in on the
 * genuine Keycloak page and is then bounced to the attacker — an open
 * redirect, the last step of most phishing flows. Only a plain absolute path
 * on this origin passes; everything else falls back to the overview. The BFF
 * has to check the same thing on its side, this is defence in depth, not a
 * substitute.
 *
 * Rejected on purpose:
 * - anything carrying a scheme (`https://…`, `javascript:…`, `mailto:…`)
 * - protocol-relative targets (`//evil.example`)
 * - backslashes (`/\evil.example` — browsers read `\` as `/`)
 * - whitespace and control characters
 */
export function safeReturnUrl(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_RETURN_URL;

  const value = candidate.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_URL;
  // \p{Cc} is the Unicode class of control characters (U+0000–001F, U+007F–009F).
  if (/[\\\s\p{Cc}]/u.test(value)) return DEFAULT_RETURN_URL;

  // Belt and braces: let the URL parser have the last word on the origin.
  try {
    const url = new URL(value, ORIGIN_PROBE);
    if (url.origin !== ORIGIN_PROBE) return DEFAULT_RETURN_URL;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/**
 * Attaches the session cookie and the CSRF header to BFF requests.
 *
 * Scoped to the BFF on purpose: sending credentials to every host would leak
 * cookies to third parties. `AuthStore` uses `fetch` directly and therefore
 * sets both itself — this covers the `HttpClient` traffic (the proxied blog
 * API) instead.
 */
export const cookieInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBffRequest(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      withCredentials: true,
      setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    }),
  );
};

function isBffRequest(url: string): boolean {
  // Both forms go through the parser: a relative base ('/api') because
  // HttpClient hands absolute URLs to interceptors once a <base href> is in
  // play, an absolute one so the origin is compared rather than assumed.
  try {
    const base = new URL(environment.bffUrl, window.location.origin);
    const target = new URL(url, window.location.origin);

    // Origin first: a path-only check would also match
    // https://other.example/api/... and hand that host our cookies.
    if (target.origin !== base.origin) return false;
    return isUnderPath(target.pathname, base.pathname);
  } catch {
    return false;
  }
}

/**
 * True when `pathname` is `base` itself or something below it.
 *
 * A bare `startsWith` would also accept `/api-internal` and `/apikeys` for the
 * base `/api` — different endpoints that would then receive the session cookie
 * and the CSRF header.
 *
 * A base of `/` is refused outright rather than treated as "everything":
 * a BFF mounted at the origin root would otherwise put credentials on every
 * request the app makes, the bundled `/data/blogs.json` fallback included.
 */
function isUnderPath(pathname: string, base: string): boolean {
  const normalised = base.endsWith('/') ? base.slice(0, -1) : base;
  if (normalised === '') return false;
  return pathname === normalised || pathname.startsWith(`${normalised}/`);
}

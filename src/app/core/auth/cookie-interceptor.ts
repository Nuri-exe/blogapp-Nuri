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
  const bffUrl = environment.bffUrl;

  // A relative base ('/api') has to be matched on the path, because HttpClient
  // hands absolute URLs to interceptors once a <base href> is in play.
  if (bffUrl.startsWith('/')) {
    try {
      const target = new URL(url, window.location.origin);
      // Same origin only: a plain path check would also match
      // https://other.example/api/... and hand that host our cookies.
      if (target.origin !== window.location.origin) return false;
      return isUnderPath(target.pathname, bffUrl);
    } catch {
      return false;
    }
  }

  return url.startsWith(bffUrl);
}

/**
 * True when `pathname` is `base` itself or something below it.
 *
 * A bare `startsWith` would also accept `/api-internal` and `/apikeys` for the
 * base `/api` — different endpoints that would then receive the session cookie
 * and the CSRF header.
 */
function isUnderPath(pathname: string, base: string): boolean {
  const normalised = base.endsWith('/') ? base.slice(0, -1) : base;
  return pathname === normalised || pathname.startsWith(`${normalised}/`);
}

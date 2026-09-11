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
    if (url.startsWith(bffUrl)) return true;

    try {
      return new URL(url, window.location.origin).pathname.startsWith(bffUrl);
    } catch {
      return false;
    }
  }

  return url.startsWith(bffUrl);
}

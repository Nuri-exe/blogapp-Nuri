import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthStore, WRITER_ROLE } from './auth-store';

/**
 * Builds a `CanMatchFn` that lets a route match only for a signed-in user who
 * holds `role`.
 *
 * `canMatch` rather than `canActivate`: it runs *before* the route is matched,
 * so a lazy chunk for a page the user may not open is never downloaded.
 *
 * The role check here is UX, not security — it keeps people out of a page whose
 * requests would be rejected anyway. The BFF and the backend make the binding
 * decision.
 */
export function roleGuard(role: string): CanMatchFn {
  return async (_route: Route, segments: UrlSegment[]) => {
    const router = inject(Router);

    if (!environment.authEnabled) {
      // Nothing can authorise this build, so the route is simply unavailable.
      return router.createUrlTree(['/blogs']);
    }

    const authStore = inject(AuthStore);

    // Wait for the session check instead of polling `loading()`: every sign-in
    // ends in a full page reload, so this runs on every protected navigation.
    await authStore.ready;

    if (authStore.isAuthenticated() && authStore.roles().includes(role)) {
      return true;
    }

    const returnUrl = '/' + segments.map((segment) => segment.path).join('/');
    return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
  };
}

/** Guard for routes that only signed-in writers may reach. */
export const authGuard: CanMatchFn = roleGuard(WRITER_ROLE);

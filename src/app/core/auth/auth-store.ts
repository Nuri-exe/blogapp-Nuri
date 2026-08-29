import { Injectable, computed, signal } from '@angular/core';

import { environment } from '../../../environments/environment';

/** Role the blog backend expects for anything that writes. */
export const WRITER_ROLE = 'user';

/** Shape of `user` in the BFF's `/auth/me` response. */
export interface UserInfo {
  preferred_username: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  // The session check is already running while the app boots.
  loading: true,
};

/**
 * Auth state for the BFF pattern.
 *
 * There is deliberately no `login(username, password)`: the browser never sees
 * a token and never posts credentials here. Signing in is a full navigation to
 * `GET /auth/login`, which redirects to Keycloak and comes back through the
 * BFF callback — see `Login`.
 *
 * State is private and only exposed through `computed()` selectors, the same
 * shape as `BlogStateService`: components read, only this store writes.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly #state = signal<AuthState>(initialState);

  readonly isAuthenticated = computed(() => this.#state().isAuthenticated);
  readonly user = computed(() => this.#state().user);
  readonly loading = computed(() => this.#state().loading);
  readonly roles = computed(() => this.#state().user?.roles ?? []);

  /**
   * Drives the create/edit/delete controls. Purely cosmetic — hiding a button
   * is not authorisation; the guard, the BFF and the backend enforce it.
   */
  readonly canWrite = computed(
    () => environment.authEnabled && this.isAuthenticated() && this.roles().includes(WRITER_ROLE),
  );

  /** Resolves once the initial session check finished — awaited by `authGuard`. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.checkSession();
  }

  /** Asks the BFF who is signed in. The cookie only travels with `credentials`. */
  async checkSession(): Promise<void> {
    if (!environment.authEnabled) {
      // No BFF deployed alongside this build — stay anonymous instead of
      // firing a request that can only 404.
      this.#state.set({ ...initialState, loading: false });
      return;
    }

    try {
      const response = await fetch(`${environment.bffUrl}/auth/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`GET /auth/me responded ${response.status}`);
      }

      const data = (await response.json()) as {
        isAuthenticated?: boolean;
        user?: UserInfo | null;
      };

      this.#state.set({
        isAuthenticated: data.isAuthenticated === true,
        user: data.user ?? null,
        loading: false,
      });
    } catch (error) {
      console.error('[AuthStore] Session check failed — continuing anonymously.', error);
      this.#state.set({ ...initialState, loading: false });
    }
  }

  /**
   * Ends both sessions and leaves the app.
   *
   * The POST clears the BFF session; navigating to the returned `logoutUrl`
   * ends Keycloak's SSO session too. Without that second step the next sign-in
   * would skip the password prompt. Callers must not navigate afterwards —
   * this method is already leaving the page.
   */
  async logout(): Promise<void> {
    try {
      const response = await fetch(`${environment.bffUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        // The BFF rejects state-changing requests without this header (CSRF).
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      const { logoutUrl } = (await response.json()) as { logoutUrl?: string };
      window.location.href = logoutUrl ?? '/';
    } catch (error) {
      console.error('[AuthStore] Logout failed — returning to the start page.', error);
      window.location.href = '/';
    }
  }
}

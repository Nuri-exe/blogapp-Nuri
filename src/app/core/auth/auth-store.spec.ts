import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthStore, UserInfo } from './auth-store';

const user: UserInfo = {
  preferred_username: 'john.doe',
  email: 'john@example.com',
  name: 'John Doe',
  roles: ['user'],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('AuthStore', () => {
  const originalAuthEnabled = environment.authEnabled;
  const originalLocation = window.location;

  let fetchMock: ReturnType<typeof vi.fn>;
  let location: { href: string };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    environment.authEnabled = true;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // jsdom refuses real navigation, so swap location for a plain recorder.
    location = { href: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: location,
    });
  });

  afterEach(() => {
    environment.authEnabled = originalAuthEnabled;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createStore(): AuthStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(AuthStore);
  }

  it('has no password-based login method', () => {
    const store = createStore();

    // The BFF pattern signs in through a redirect; credentials never reach
    // this app, so a login(username, password) would be a design error.
    expect((store as unknown as Record<string, unknown>)['login']).toBeUndefined();
  });

  describe('checkSession', () => {
    it('sends the session cookie and stores the user', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ isAuthenticated: true, user }));

      const store = createStore();
      await store.ready;

      expect(fetchMock).toHaveBeenCalledWith(`${environment.bffUrl}/auth/me`, {
        credentials: 'include',
      });
      expect(store.isAuthenticated()).toBe(true);
      expect(store.user()).toEqual(user);
      expect(store.roles()).toEqual(['user']);
      expect(store.hasRole('user')).toBe(true);
      expect(store.canWrite()).toBe(true);
      expect(store.loading()).toBe(false);
    });

    it('stays anonymous for a signed-out visitor', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ isAuthenticated: false, user: null }));

      const store = createStore();
      await store.ready;

      expect(store.isAuthenticated()).toBe(false);
      expect(store.user()).toBeNull();
      expect(store.roles()).toEqual([]);
      expect(store.canWrite()).toBe(false);
      expect(store.loading()).toBe(false);
    });

    it('clears loading even when the BFF is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));

      const store = createStore();
      await store.ready;

      expect(store.isAuthenticated()).toBe(false);
      // Critical: a hanging loading flag would keep every guard waiting forever.
      expect(store.loading()).toBe(false);
    });

    it('treats a non-OK response as signed out', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false, 500));

      const store = createStore();
      await store.ready;

      expect(store.isAuthenticated()).toBe(false);
      expect(store.loading()).toBe(false);
    });

    it('skips the request entirely when auth is disabled for this build', async () => {
      environment.authEnabled = false;

      const store = createStore();
      await store.ready;

      expect(fetchMock).not.toHaveBeenCalled();
      expect(store.loading()).toBe(false);
      expect(store.canWrite()).toBe(false);
    });
  });

  describe('logout', () => {
    it('posts with the CSRF header and then leaves for Keycloak', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ isAuthenticated: true, user }))
        .mockResolvedValueOnce(jsonResponse({ logoutUrl: 'https://keycloak.test/logout' }));

      const store = createStore();
      await store.ready;
      await store.logout();

      expect(fetchMock).toHaveBeenLastCalledWith(`${environment.bffUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      // Without this navigation the Keycloak SSO session would survive and the
      // next sign-in would skip the password prompt.
      expect(location.href).toBe('https://keycloak.test/logout');
    });

    it('falls back to the start page when the logout call fails', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ isAuthenticated: true, user }))
        .mockRejectedValueOnce(new Error('offline'));

      const store = createStore();
      await store.ready;
      await store.logout();

      expect(location.href).toBe('/');
    });
  });
});

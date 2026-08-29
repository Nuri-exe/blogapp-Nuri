import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { authGuard } from './auth-guard';
import { AuthStore } from './auth-store';

/** Minimal stand-in for the store — the guard only reads three things. */
interface AuthStub {
  ready: Promise<void>;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
}

describe('authGuard', () => {
  const originalAuthEnabled = environment.authEnabled;

  beforeEach(() => {
    environment.authEnabled = true;
  });

  afterEach(() => {
    environment.authEnabled = originalAuthEnabled;
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function run(auth: Partial<AuthStub>) {
    const stub: AuthStub = {
      ready: Promise.resolve(),
      isAuthenticated: () => true,
      hasRole: () => true,
      ...auth,
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: stub }],
    });

    const segments = [new UrlSegment('blogs', {}), new UrlSegment('new', {})];
    const snapshot = {} as Parameters<CanMatchFn>[2];

    return TestBed.runInInjectionContext(
      () => authGuard({} as Route, segments, snapshot) as Promise<boolean | UrlTree>,
    );
  }

  it('lets a signed-in writer through', async () => {
    expect(await run({})).toBe(true);
  });

  it('redirects an anonymous visitor to the login page, keeping the target', async () => {
    const result = await run({ isAuthenticated: () => false });

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fblogs%2Fnew',
    );
  });

  it('redirects a signed-in user who lacks the role', async () => {
    const result = await run({ hasRole: () => false });

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('/login');
  });

  it('sends the route out of reach when auth is disabled for this build', async () => {
    environment.authEnabled = false;

    const result = await run({});

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/blogs');
  });

  it('waits for the session check instead of deciding on a half-loaded store', async () => {
    let signedIn = false;
    let resolveReady!: () => void;

    const ready = new Promise<void>((resolve) => {
      resolveReady = () => {
        // The session check lands right before the promise settles.
        signedIn = true;
        resolve();
      };
    });

    const pending = run({ ready, isAuthenticated: () => signedIn });

    // Nothing has been decided yet — the guard is still awaiting `ready`.
    resolveReady();

    expect(await pending).toBe(true);
  });
});

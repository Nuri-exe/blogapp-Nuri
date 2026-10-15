import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { cookieInterceptor } from './cookie-interceptor';

/**
 * Scoping of the BFF match. The happy paths live in cookie-interceptor.spec.ts;
 * these are the look-alikes that a plain `startsWith('/api')` would wrongly
 * accept — each one would hand the session cookie and the CSRF header to an
 * endpoint that is not the BFF.
 */
describe('cookieInterceptor scoping', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cookieInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function credentialsSentTo(url: string): boolean {
    http.get(url).subscribe({ next: () => undefined, error: () => undefined });
    const request = httpMock.expectOne(url);
    const sent = request.request.withCredentials;
    request.flush({});
    return sent;
  }

  it.each(['/api', '/api/auth/me', '/api/entries?page=1'])(
    'sends credentials to the BFF itself: %s',
    (url) => {
      expect(credentialsSentTo(url)).toBe(true);
    },
  );

  it.each([
    ['sibling path with a shared prefix', '/api-internal/secrets'],
    ['no separator at all', '/apikeys'],
    ['file that merely starts with the prefix', '/api.json'],
    ['unrelated path', '/assets/data.json'],
  ])('does not send credentials to %s', (_label, url) => {
    expect(credentialsSentTo(url)).toBe(false);
  });

  it('does not send credentials to a foreign host whose path starts with /api', () => {
    expect(credentialsSentTo('https://other.example/api/entries')).toBe(false);
  });

  it('sends credentials to the BFF when addressed absolutely on this origin', () => {
    expect(credentialsSentTo(`${window.location.origin}/api/auth/me`)).toBe(true);
  });
});

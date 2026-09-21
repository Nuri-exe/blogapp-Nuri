import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import Login from './login';

/**
 * The `error` query parameter is attacker-controlled: anyone can mail a link
 * to /login?error=… and the page renders whatever it resolves to.
 */
describe('Login error messages', () => {
  function messageFor(error: string | undefined): string | null {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Login);
    fixture.componentRef.setInput('error', error);
    fixture.detectChanges();

    // The <span> only — the sibling <mat-icon> renders its ligature name as text.
    const message = fixture.nativeElement.querySelector('[data-testid="login-error"] span');
    return message ? (message.textContent ?? '').trim() : null;
  }

  const GENERIC = 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.';

  it('renders the message for a known code', () => {
    expect(messageFor('access_denied')).toBe('Die Anmeldung wurde abgebrochen.');
  });

  it('shows nothing at all without a code', () => {
    expect(messageFor(undefined)).toBeNull();
  });

  it('collapses an unknown code to the generic message', () => {
    expect(messageFor('totally-made-up')).toBe(GENERIC);
  });

  // A plain object literal would resolve these through Object.prototype and
  // print e.g. "function Object() { [native code] }" into the page.
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'does not leak the prototype member %s',
    (error) => {
      expect(messageFor(error)).toBe(GENERIC);
    },
  );
});

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../environments/environment';
import { DEFAULT_RETURN_URL, safeReturnUrl } from '../../core/auth/return-url';

const GENERIC_ERROR = 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.';

/**
 * Messages the BFF callback can redirect here with.
 *
 * A `Map`, not an object literal: the key comes from the query string, and a
 * plain object would happily resolve inherited keys — `?error=constructor`
 * rendered `function Object() { [native code] }` straight into the page.
 */
const ERROR_MESSAGES = new Map<string, string>([
  ['access_denied', 'Die Anmeldung wurde abgebrochen.'],
  ['expired', 'Der Anmeldeversuch ist abgelaufen. Bitte versuche es erneut.'],
  ['failed', GENERIC_ERROR],
]);

/**
 * Sign-in page — deliberately without a form.
 *
 * Username and password are typed on Keycloak's own page; this app never sees
 * them. All that is left here is a button that starts the redirect flow.
 */
@Component({
  selector: 'app-login',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Login {
  // Bound from the query string via withComponentInputBinding().
  readonly returnUrl = input(DEFAULT_RETURN_URL);
  readonly error = input<string | undefined>();

  protected readonly authEnabled = environment.authEnabled;

  /** Unknown codes collapse to the generic message, so no raw code reaches the UI. */
  protected readonly errorMessage = computed(() => {
    const error = this.error();
    if (!error) return null;
    return ERROR_MESSAGES.get(error) ?? GENERIC_ERROR;
  });

  /**
   * The query string is attacker-controlled, so the redirect target is
   * validated before it goes anywhere near a navigation — see `safeReturnUrl`.
   */
  protected readonly target = computed(() => safeReturnUrl(this.returnUrl()));

  /**
   * A full navigation, not a fetch: the browser has to follow the BFF's 302 to
   * Keycloak and carry the `__pkce` cookie back to the callback. A fetch would
   * follow the redirect invisibly and drop the user on a CORS error.
   */
  protected signIn(): void {
    const returnUrl = encodeURIComponent(this.target());
    window.location.href = `${environment.bffUrl}/auth/login?returnUrl=${returnUrl}`;
  }
}

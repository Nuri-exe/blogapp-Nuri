import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/**
 * The single breakpoint between "phone" and everything wider.
 *
 * Must match `$breakpoint-tablet` in `styles/_variables.scss`: the SCSS media
 * queries and this JavaScript query have to agree on the boundary, otherwise
 * the toolbar could hide its links while the drawer thinks it is on desktop.
 */
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/**
 * Viewport size as a signal, fed by `window.matchMedia()`.
 *
 * `matchMedia` fires `change` only when the query flips — not on every resize
 * pixel — so this is far cheaper than a `resize` listener and needs no
 * debouncing.
 *
 * On cleanup: this service is `providedIn: 'root'`, so it lives as long as the
 * application and the listener would die with the window anyway. It is still
 * unregistered through `DestroyRef` (root injector → `ApplicationRef.destroy()`)
 * because TestBed tears the injector down after every spec, and a listener that
 * outlives its test leaks into the next one. A *component* registering the same
 * listener would need this for real: every navigation away from it would
 * otherwise leave a callback behind that writes into a destroyed view.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  /**
   * Desktop until proven otherwise — on the server and in jsdom there is no
   * viewport to ask, and the wide layout is the one that degrades gracefully.
   */
  readonly #matchesDesktop = signal(true);

  /** `true` below 768px. */
  readonly isMobile = computed(() => !this.#matchesDesktop());

  constructor() {
    const query = inject(DOCUMENT).defaultView?.matchMedia?.(DESKTOP_MEDIA_QUERY);
    if (!query) return;

    this.#matchesDesktop.set(query.matches);

    // Passing an AbortSignal to addEventListener is the modern spelling of
    // removeEventListener: aborting the controller drops the listener.
    const subscription = new AbortController();
    query.addEventListener('change', (event) => this.#matchesDesktop.set(event.matches), {
      signal: subscription.signal,
    });
    inject(DestroyRef).onDestroy(() => subscription.abort());
  }
}

export const environment = {
  production: false,
  /**
   * Same-origin through the dev-server proxy (see `proxy.conf.json`), so blog
   * requests travel via the BFF and get a bearer token attached server-side.
   */
  apiBaseUrl: '/api',
  /** Upper bound per request so a hanging backend cannot freeze the UI. */
  apiTimeoutMs: 8000,
  /**
   * Same origin as the app — a cross-origin BFF could not set the session
   * cookie that the Keycloak callback lands on.
   */
  bffUrl: '/api',
  authEnabled: true,
};

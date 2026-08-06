export const environment = {
  production: true,
  /** Blog REST API (see `src/app/data/README.md` — the `/entries` endpoint). */
  apiBaseUrl: 'https://d-cap-blog-backend---v2.whitepond-b96fee4b.westeurope.azurecontainerapps.io',
  /** Upper bound per request so a hanging backend cannot freeze the UI. */
  apiTimeoutMs: 8000,
};

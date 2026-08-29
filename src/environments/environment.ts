export const environment = {
  production: true,
  /** Blog REST API (see `src/app/data/README.md` — the `/entries` endpoint). */
  apiBaseUrl: 'https://d-cap-blog-backend---v2.whitepond-b96fee4b.westeurope.azurecontainerapps.io',
  /** Upper bound per request so a hanging backend cannot freeze the UI. */
  apiTimeoutMs: 8000,
  /** Base URL of the BFF. Unused while `authEnabled` is false. */
  bffUrl: '/api',
  /**
   * Off in production on purpose: this app deploys to an Azure Storage static
   * website, which cannot host the Azure Functions BFF. Leaving auth on would
   * put a sign-in button on the deployed site that leads nowhere.
   */
  authEnabled: false,
};

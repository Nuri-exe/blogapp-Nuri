import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { cookieInterceptor } from './core/auth/cookie-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // withComponentInputBinding() also feeds the login page its `returnUrl`
    // and `error` query parameters.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([cookieInterceptor])),
  ],
};

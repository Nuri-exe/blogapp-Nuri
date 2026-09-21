# Security-Audit

Kurstag 11, Aufgaben 4, 5 und 7. Geprüfter Stand: Branch
`feature/responsive-security`, Angular 22.1.7.

Der Audit lief in drei unabhängigen Durchgängen (DOM/XSS-Senken, Redirects und
Auth-Grenze, Konfiguration und Lieferkette). Jeder Befund unten wurde vor dem
Fix von Hand am Code nachvollzogen — mit Dateiverweis und Beleg, nicht nach
Gefühl.

## Findings

| Nr. | Datei                                        | Problem                                                                                                   | Risiko  | Fix                                                                                         |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1   | `src/app/app.routes.ts:31`                   | `blogs/create` ohne Guard, während die beiden anderen Schreib-Routen `canMatch: [authGuard]` tragen       | Mittel  | `canMatch: [authGuard]` ergänzt; „Schreiben"-Link hängt an `auth.canWrite()`                |
| 2   | `src/app/feature/auth/login.ts:50`           | `returnUrl` aus dem Query-String ungeprüft an den BFF weitergereicht → Open Redirect                      | Mittel  | `safeReturnUrl()`: nur absolute Pfade dieser Origin, sonst `/blogs`; 21 Tests               |
| 3   | `src/app/feature/auth/login.ts:40`           | `ERROR_MESSAGES[error]` löst über `Object.prototype` auf: `?error=constructor` rendert Funktionsquelltext | Niedrig | `Map` statt Objekt-Literal; Test über alle fünf Prototype-Keys                              |
| 4   | `src/app/core/auth/cookie-interceptor.ts:32` | `startsWith('/api')` trifft auch `/api-internal`, `/apikeys`; absolute URLs nur per Pfad geprüft          | Niedrig | Origin-Vergleich + Segmentgrenze; 9 Tests für die Look-alikes                               |
| 5   | `src/app/feature/blog/blog-form.ts:45`       | `/blogs/new?id=7` schaltet das Formular still in den Edit-Modus (Query-Param füllt `id`)                  | Niedrig | Entscheidung kommt aus Route-`data`, die Query-Parameter überstimmen                        |
| 6   | `src/app/core/auth/auth-store.ts:115`        | `logoutUrl` aus der BFF-Antwort direkt auf `window.location.href` — am Sanitizer vorbei                   | Niedrig | `safeLogoutUrl()`: nur `http(s)`, sonst Startseite                                          |
| 7   | `src/app/feature/blog/blog-schema.ts:31`     | `headerImageUrl` beliebiger String an `<img [src]>`; http wäre Mixed Content                              | Niedrig | Schema nimmt nur `https://`; `img-src` erzwingt dasselbe im Browser                         |
| 8   | `src/app/feature/blog/blog-schema.ts:35`     | `createdAt`/`updatedAt` beliebiger String; `toDate()` wirft RuntimeError 2311 in der Change Detection     | Niedrig | Unparsbare Werte fallen auf `''` — der Fall, den `DatePipe` als „nichts anzeigen" behandelt |
| 9   | `src/index.html`                             | Keine Content Security Policy                                                                             | Mittel  | CSP als `<meta http-equiv>`, siehe unten                                                    |
| 10  | `src/index.html:9`                           | Google Fonts von fremder Origin: bricht unter `style-src 'self'` und verrät Besucher-IPs an Google        | Niedrig | `@fontsource/roboto` + `@fontsource/material-icons` gebündelt, `<link>`-Tags entfernt       |
| 11  | `package.json`                               | 29 npm-Advisories, darunter Sanitizer-Bypässe in Angular selbst                                           | Hoch    | Auf 22.1.7 gehoben, `npm audit fix`; jetzt 0 Befunde                                        |

### Befunde, die dokumentiert und nicht behoben wurden

Diese betreffen die Deployment-Pipeline, nicht die Anwendung. Sie brauchen
Zugriff auf das Azure-Abo und lassen sich hier nicht testen — sie gehören in
ein eigenes Ticket, nicht in diesen PR:

| Nr. | Datei                                   | Problem                                                                                           | Risiko  | Empfehlung                                                         |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| 12  | `.github/workflows/azure-deploy.yml:46` | Deploy authentisiert mit einem unbefristeten Storage-Account-Key (Vollzugriff auf alle Container) | Mittel  | OIDC-Federation mit RBAC auf den `$web`-Container                  |
| 13  | `.github/workflows/azure-deploy.yml:9`  | Deploy läuft bei jedem Push auf `main`, unabhängig davon, ob die CI grün ist                      | Mittel  | An den CI-Workflow koppeln, `concurrency`-Gruppe setzen            |
| 14  | `.github/workflows/*.yml`               | Actions auf bewegliche Tags gepinnt (`azure/CLI@v3`) statt auf Commit-SHAs                        | Niedrig | Auf SHA pinnen — betrifft genau den Schritt, der die Secrets sieht |

## Was sauber war

Die Suche nach den klassischen Senken blieb leer, und das ist der eigentliche
Befund von Aufgabe 4:

- **`[innerHTML]`, `innerHTML=`, `outerHTML`, `insertAdjacentHTML`** — null
  Treffer im gesamten `src/`.
- **`bypassSecurityTrust*`, `DomSanitizer`, `SafeHtml`/`SafeUrl`** — null
  Treffer. Keine Komponente injiziert den Sanitizer.
- **`eval`, `new Function`, `document.write`, `setTimeout` mit String** — null
  Treffer im Anwendungscode. (zod probierte `new Function('')` als
  Feature-Probe; das ist jetzt per `jitless` abgeschaltet, siehe unten.)
- **`<iframe>`, `<object>`, `[srcdoc]`** — null Treffer.
- **Interpolation `{{ }}`** — alle Backend-Strings (Titel, Autor, Vorschau,
  Zahlen) gehen durch die Interpolation, die Angular automatisch escaped. Das
  ist der sichere Weg und bleibt so.
- **`[href]`-Bindings** — keine. Alle Links sind `routerLink` mit
  Kommando-Arrays; die `id` ist `z.number()`, der Router baut die URL selbst.
- **`[style]`, `[ngStyle]`, `[attr.*]` mit Backend-Daten** — keine.

## Auth-Guards (Aufgabe 5)

| Route            | Guard                 | Begründung                                 |
| ---------------- | --------------------- | ------------------------------------------ |
| `blogs`          | —                     | öffentliche Übersicht                      |
| `blogs/:id`      | —                     | öffentlicher Beitrag                       |
| `blogs/new`      | `canMatch: authGuard` | legt Inhalte an                            |
| `blogs/create`   | `canMatch: authGuard` | legt Inhalte an — **in diesem PR ergänzt** |
| `blogs/:id/edit` | `canMatch: authGuard` | ändert Inhalte                             |
| `login`, `about` | —                     | öffentlich                                 |

`canMatch` statt `canActivate`: der Guard läuft, _bevor_ die Route matcht, der
Lazy-Chunk einer gesperrten Seite wird also gar nicht erst geladen. Er gibt
`true` oder einen `UrlTree` zurück, nie `false` — bei `false` würde der Router
weiterprobieren und `/blogs/new` als `/blogs/:id` mit `id='new'` matchen.

Nicht angemeldete Besucher landen auf `/login?returnUrl=…`; in diesem Build
(`authEnabled: false`, kein BFF erreichbar) auf `/blogs`, weil eine Anmeldung
gar nicht möglich ist. Ein E2E-Test prüft beide Fälle.

Der Guard ist **UX, keine Sicherheitsgrenze**: er hält Leute von einer Seite
fern, deren Requests der Server ohnehin ablehnen würde. Die verbindliche
Entscheidung treffen BFF und Backend.

## Content Security Policy (Aufgabe 7)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' https:;
  connect-src 'self' https://d-cap-blog-backend---v2.whitepond-b96fee4b.westeurope.azurecontainerapps.io;
  object-src 'none';
  base-uri 'self';
  form-action 'self'
```

Ausgeliefert als `<meta http-equiv>` in `src/index.html`. Warum nicht als
HTTP-Header: das Ziel ist eine Azure-Storage-Static-Website, die nur Blobs
ausliefert und keine eigenen Response-Header setzen kann — der Deploy ist ein
`az storage blob upload-batch`. `staticwebapp.config.json` würde nur Azure
**Static Web Apps** auswerten, ein anderes Produkt.

Zu den einzelnen Direktiven:

- **`style-src 'unsafe-inline'`** ist unvermeidlich: Angular spielt
  Komponenten-Styles als `<style>`-Elemente ein und Material setzt inline
  `style`-Attribute. Das Arbeitsblatt verlangt es ausdrücklich.
- **`script-src 'self'`** kommt ohne `'unsafe-inline'` aus. Der Prod-Build
  enthält genau ein externes `<script type="module">` und keinen Inline-Code —
  nachgeprüft im gebauten `index.html`.
- **`font-src 'self'`** funktioniert nur, weil die Fonts gebündelt sind. Mit
  den Google-Fonts-Links wäre jedes `<mat-icon>` als Text erschienen („menu",
  „dark_mode"), weil die Ligatur-Schrift blockiert würde.
- **`img-src https:`** ist nötig, weil `headerImageUrl` beliebige fremde Hosts
  enthält (in den Beispieldaten Unsplash).
- **`connect-src`** muss den API-Host nennen; mit `'self'` allein würde jeder
  Blog-Request scheitern, weil die API auf einer anderen Origin liegt.

**Was ein Meta-Tag nicht kann:** `frame-ancestors`, `report-uri`/`report-to`
und `sandbox` werden nur als HTTP-Header ausgewertet. Für Clickjacking-Schutz
(`frame-ancestors 'none'`) und HSTS braucht es also einen echten Header —
möglich hinter einem Azure Front Door, einer CDN-Rule oder bei einem Umzug auf
Azure Static Web Apps. Der Header wäre derselbe wie oben, ergänzt um:

```
Content-Security-Policy: …; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### zod und `script-src`

zod probiert beim ersten Validieren einmal `new Function('')`, um zu
entscheiden, ob es einen schnelleren Validator kompilieren darf. Es fängt den
Fehler ab, aber der Browser meldet den Versuch trotzdem als
`script-src`-Verstoss — in der Konsole und über das
`securitypolicyviolation`-Event. `z.config({ jitless: true })` in
`blog-schema.ts` überspringt die Probe. Ein E2E-Test zählt die Verstösse über
Übersicht, Detailseite und Login und erwartet null.

## npm audit (Experte)

Vorher: **29 Befunde** (1 critical, 18 high, 6 moderate, 4 low). Die ernsten
lagen im Framework selbst, nicht in irgendeiner Randbibliothek:

| Advisory              | Paket                       | Problem                                     | Behoben in |
| --------------------- | --------------------------- | ------------------------------------------- | ---------- |
| `GHSA-58w9-8g37-x9v5` | `@angular/compiler`         | Sanitizer-Bypass über Two-Way-Binding (XSS) | 22.0.1     |
| `GHSA-jj27-h5hq-8x99` | `@angular/core`, `compiler` | XSS über i18n-Event-Handler-Attribute       | 22.0.1     |
| `GHSA-hh8m-fm6v-7cvg` | `@angular/core`, `compiler` | Sanitizer-Bypass über Host-Bindings         | 22.1.0     |
| `GHSA-rgjc-h3x7-9mwg` | `@angular/core`             | DOM Clobbering bei der Hydration            | 22.0.1     |
| `GHSA-jhpw-976m-542j` | `@angular/common`           | Cache-Key-Kollision im `HttpTransferCache`  | 22.0.2     |
| `GHSA-p297-fm68-3q8c` | `@angular/common`           | Info-Leak über `HttpTransferCache`          | 22.1.1     |

Dazu transitive Befunde in `hono`, `brace-expansion`, `fast-uri`,
`browserslist`, `esbuild` und `@vitest/mocker`.

Nachher: **0 Befunde** über 885 Abhängigkeiten. Erreicht durch das Anheben auf
Angular 22.1.7 (die Versionen, die der `ng-update`-Bot des Kurses auf
`chore-ng-update-b1ab190` vorschlug) plus `npm audit fix` ohne `--force`.

Bemerkenswert daran: Punkt 4 des Arbeitsblatts fragt nach `innerHTML` und
`bypassSecurityTrust` im eigenen Code — dort war nichts. Die einzigen echten
XSS-Lücken im Projekt steckten in einer veralteten Angular-Version, also genau
dort, wohin die Checkliste nicht schaut.

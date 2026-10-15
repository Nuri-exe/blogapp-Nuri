# End-to-End-Tests mit Playwright

Die E2E-Tests starten die gebaute App in einem echten Chromium und bedienen sie
wie ein Nutzer. Sie sind bewusst wenige: Alles, was sich ohne Browser prüfen
lässt, steht in den Unit-Tests (`testing.md`).

## Befehle

| Befehl                       | Wirkung                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `npm run e2e`                | Baut die App, serviert `dist/app/browser` auf Port 4200 und startet die Tests |
| `npm run e2e:ui`             | Dasselbe im interaktiven Playwright-UI                                        |
| `npx playwright show-report` | Öffnet den HTML-Bericht des letzten Laufs                                     |

In der CI baut ein früherer Schritt die App bereits; `playwright.config.ts`
startet dort nur noch den Server (`CI` ist gesetzt).

**Warum das Produktions-Bundle und nicht `ng serve`?** `ng serve` läuft mit der
Development-Konfiguration, in der `authEnabled` auf `true` steht. Die Schreib-Routen
leiten dann nach `/login` statt nach `/blogs` um — Tests, die in der CI grün sind,
wären lokal rot. Beide Orte testen jetzt dasselbe Bundle.

Wenn ein Test fehlschlägt, liegen in `test-results/` ein Screenshot und ein Trace
(`npx playwright show-trace <trace.zip>`). Beides wird nur bei Fehlern gespeichert.

## Deterministische Daten

Das Produktions-Bundle spricht mit dem gemeinsamen Backend der Lehrperson. Dessen
Inhalt ändert sich und es kann während einer CI-Runde nicht erreichbar sein; ein
Test, der davon abhängt, ist aus Gründen rot oder grün, die mit der App nichts
zu tun haben.

`e2e/fixtures.ts` erweitert `test` deshalb um ein **automatisches** Fixture
`backend`, das `GET /entries` im Browser abfängt (`page.route`) und eine feste
Antwort liefert: vier Einträge, drei Autorinnen und Autoren, IDs ab 101. (Die
Beispieldaten in `public/data/blogs.json` haben IDs 1–6; ein Test, der sie
versehentlich liest, fällt an den IDs auf.)

- `test.use({ entries: [] })` ändert die Startdaten für einen Block.
- `backend.goDown()` lässt die Anfrage fehlschlagen — die App fällt auf die Beispieldaten zurück.
- `backend.serve(entries)` stellt wieder eine Antwort her (und holt ein „abgestürztes" Backend zurück).
- **Schreibzugriffe sind gesperrt:** Jedes `POST`/`PUT`/`DELETE` auf `/entries` wird
  mit 501 beantwortet und aufgezeichnet; am Ende jedes Tests wird geprüft, dass
  die Liste leer ist. Ein Test kann so keine Daten im echten Backend verändern.

Fremde Bilder (`images.unsplash.com`, nur in den Beispieldaten) werden
abgebrochen, damit ein langsamer Drittanbieter die Suite nicht bremst.

## Akzeptanzkriterien der Blog-Liste (`/blogs`)

| Nr. | Kriterium                                                                                                                                                | Test(s) in `blog-list.spec.ts`                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| AK1 | Jeder vom Backend gelieferte Eintrag erscheint als genau eine Karte, in der gelieferten Reihenfolge; die Seite nennt die Anzahl („4 von 4 Beiträgen").   | `AK1: shows one card per entry, in the delivered order`     |
| AK2 | Jede Karte zeigt den Titel (als Link auf `/blogs/:id`), die Zusammenfassung und den Autor.                                                               | `AK2: every card shows its title as a link and its summary` |
| AK3 | Wer einen Autor wählt, sieht nur dessen Einträge, die Anzahl lautet „x von y"; „Alle Autoren" bringt die übrigen zurück; die Wahl überlebt ein Neuladen. | `AK3: author filter` (4 Tests)                              |

Dazu die Zustände, die ein Nutzer sonst nie sieht: leeres Blog, Autor ohne Einträge
(gespeicherter Filter, den es nicht mehr gibt), Backend nicht erreichbar (Hinweis +
Beispieldaten) und „auch die Beispieldaten fehlen" (Fehlermeldung, „Erneut
versuchen" holt die Liste zurück).

## Zweite Seite: Detailansicht (`/blogs/:id`)

`blog-detail.spec.ts` prüft, dass die Detailseite den ganzen Eintrag zeigt, auch bei
direktem Aufruf (der Resolver muss die Liste selbst laden), dass „Zurück zur
Übersicht" funktioniert, dass eine unbekannte ID „Beitrag nicht gefunden" zeigt —
und dass beide Seiten **denselben Zustand** lesen: Ein Like auf der Übersicht ist
auf der Detailseite sichtbar. Ohne Auth-Backend gibt es weder „Bearbeiten" noch
„Löschen".

## Der KI-Entwurf und was daran falsch war

Aufgabe 4 verlangt einen KI-Entwurf mit anschließendem Review. Der Entwurf unten
ist die Art Test, die ein Assistent liefert, wenn er nur die Kriterien und die URL
kennt (hier nachgestellt, nicht eingecheckt):

```ts
await page.goto('http://localhost:4200');
await page.waitForTimeout(2000);
// ...
const posts = await page.locator('.blog-post').all();
for (const post of posts) {
  await expect(post.locator('.blog-title')).toBeVisible();
}
// ...
await page.selectOption('select#author-filter', { index: 1 });
```

Gemessen gegen die laufende App: **2 Tests grün, 1 rot.** Beide grünen sind
trügerisch:

| Problem im Entwurf                                                  | Folge                                                                                                       | Korrektur                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Erfundene Selektoren (`.blog-post`, `.blog-title`, `.blog-summary`) | `.all()` liefert eine leere Liste, die Schleife läuft null Mal, der Test ist **grün, ohne etwas zu prüfen** | Assertions auf dem Locator selbst (`toHaveCount`, `toHaveText([...])`) — sie scheitern bei null Treffern |
| `expect(await cards.count()).toBeGreaterThan(0)`                    | Liest die Zahl einmal, wartet nicht; „mindestens eine" prüft nicht die Daten                                | `toHaveCount(4)` mit Wiederholung, plus Titel und Reihenfolge                                            |
| `select#author-filter` + `selectOption`                             | Der Filter ist ein `mat-select` (Overlay), kein `<select>` — Timeout nach 30 s                              | `getByRole('combobox', { name: 'Autor' })`, `getByRole('option', …)`                                     |
| `waitForTimeout(2000)`                                              | Langsam und trotzdem nicht sicher                                                                           | Web-first-Assertions warten selbst                                                                       |
| Feste URL im Test                                                   | Läuft nur auf einem Port                                                                                    | `baseURL` aus der Konfiguration                                                                          |
| Abhängig vom Live-Backend                                           | Ergebnis ändert sich mit den Daten der Lehrperson                                                           | Fixture mit festen Daten                                                                                 |

**Beweis, dass die grünen Tests nichts wert waren:** Die App wurde so
kaputt gebaut, dass alle sechs Karten einen leeren Titel zeigten (6 Karten, 0
nichtleere Titel). Die beiden trügerisch grünen Tests blieben grün.

## Wie man weiß, dass die E2E-Tests etwas taugen

Gleiches Verfahren wie bei den Unit-Tests: Produktivcode gezielt kaputt machen,
Bundle neu bauen, Suite laufen lassen. **10 von 10 Mutationen wurden erkannt.**

| Mutation                                   | Rote Tests (Auswahl)                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| Autorenfilter ignoriert                    | 4 — u. a. „narrows the cards", „still applied after a reload" |
| Zähler zeigt `x von x`                     | 2                                                             |
| Karte zeigt Autor statt Zusammenfassung    | AK2                                                           |
| Karten-Link zeigt auf die Liste            | 3 — AK2, Detailseite, Like-Zustand                            |
| Like tut nichts                            | 2                                                             |
| Kein Rückfall auf Beispieldaten            | „falls back to the bundled sample data"                       |
| Detailseite zeigt Autor als Titel          | 2                                                             |
| Resolver lädt die Liste nicht              | 4 — Direktaufruf, Zurück, Like                                |
| Autorenliste nicht sortiert                | „lists the authors once each"                                 |
| Filter nicht in `localStorage` gespeichert | „still applied after a reload"                                |

Stabilität: Die 17 neuen Tests liefen sechsmal hintereinander mit vier parallelen
Workern — 102 von 102 grün.

## Was nicht Teil dieser Suite ist

`e2e/app.spec.ts` (Smoke-Tests gegen das echte Backend bzw. die Beispieldaten) bleibt
unverändert. Der Formular-Test dort deckt `/blogs/create` ab; die neuen Specs fassen
es bewusst nicht an.

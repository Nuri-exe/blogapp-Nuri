# Testing: Unit-Tests mit Vitest

Dieses Dokument beschreibt, wie die App getestet wird, wie man die Tests startet
und welche Stolpersteine es gibt. Die End-to-End-Tests (Playwright) stehen in
`e2e-testing.md`.

## Die Pyramide in diesem Projekt

| Ebene          | Werkzeug             | Läuft in      | Was sie beantwortet                                     |
| -------------- | -------------------- | ------------- | ------------------------------------------------------- |
| Unit (Service) | Vitest via `ng test` | jsdom         | Stimmt die Logik? (Zustand, Signale, Gateway)           |
| Komponente     | Vitest + `TestBed`   | jsdom         | Rendert die Komponente aus ihren Eingaben das Richtige? |
| End-to-End     | Playwright           | echter Chrome | Funktioniert das Zusammenspiel im Browser?              |

Je weiter oben, desto schneller und genauer zeigt ein roter Test auf die Ursache.
Je weiter unten, desto näher ist er an dem, was ein Nutzer erlebt. Deshalb viele
Unit-Tests, wenige E2E-Tests — und jedes Verhalten dort, wo es am billigsten
geprüft werden kann.

## Befehle

| Befehl                                            | Wirkung                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `npm test`                                        | Vitest im Watch-Modus                                |
| `npm run test:ci`                                 | Einmaliger Lauf mit Coverage (so läuft es in der CI) |
| `npx ng test --no-watch --include <pfad>.spec.ts` | Nur eine Datei                                       |

### `npx vitest` funktioniert hier nicht

Das Arbeitsblatt nennt `npx vitest`. In diesem Projekt startet man Vitest aber
über den Angular-Builder (`@angular/build:unit-test`, siehe `angular.json`):
Der kompiliert die Specs (Templates, Signal-Inputs, `templateUrl`), stellt
`describe`/`it`/`expect` global bereit und richtet jsdom ein. Ein nacktes
`npx vitest run` kennt nichts davon und bricht mit `describe is not defined` ab —
und es sammelt zusätzlich `e2e/*.spec.ts` ein, die Playwright gehören.

## Stand

Gemessen mit `npm run test:ci` (Statements/Branches/Functions/Lines):

|             | vorher (`main`) | nachher |
| ----------- | --------------- | ------- |
| Testdateien | 7               | 10      |
| Tests       | 68              | 127     |
| Statements  | 88,3 %          | 93,8 %  |
| Branches    | 84,1 %          | 90,4 %  |
| Functions   | 88,5 %          | 95,7 %  |
| Lines       | 89,4 %          | 94,6 %  |

Ein Teil des Sprungs ist ehrlich verdient, ein Teil Bilanzkosmetik: Die neuen
Specs laden Dateien, die vorher kein Test berührte, und diese erscheinen erst
dadurch im Bericht (siehe „Coverage: ein blinder Fleck"). Die Zahl allein sagt
deshalb weniger als die Mutationsprobe unten.

## Was getestet wird

| Datei                                     | Tests | Schwerpunkt                                                                |
| ----------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `shared/blog-card/blog-card.spec.ts`      | 15    | Komponente: Inhalt, `like`-Output, Bild, Besitzer-Chip, HTML im Titel      |
| `feature/blog/blog-list.spec.ts`          | 14    | Komponente gegen einen Store-Fake: Karten, Zustände, Filter, Like          |
| `feature/blog/blog-state-service.spec.ts` | 32    | Zustand: Laden, `blogCount` (computed), Persistenz (effect), Filter, Likes |
| `core/theme/theme-service.spec.ts`        | 13    | Signale + `effect` + `matchMedia` + `localStorage`                         |
| `feature/blog/blog-service.spec.ts`       | 17    | Gateway: HTTP, Validierung, kaputte Antworten (null, Müll, leere Listen)   |

## Muster

### Komponenten mit Signal-Inputs

Signal-Inputs werden nicht zugewiesen, sondern gesetzt:

```ts
fixture = TestBed.createComponent(BlogCard);
fixture.componentRef.setInput('blog', blog({ title: 'Neu' }));
await fixture.whenStable();
```

Der `like`-Output ist ein `OutputEmitterRef`; man hört mit
`fixture.componentInstance.like.subscribe(spy)` mit.

### Eine Seitenkomponente gegen einen Store-Fake

`BlogList` bekommt in `blog-list.spec.ts` einen Fake mit schreibbaren Signalen.
So lässt sich jeder Zustand (lädt, leer, offline, Fehler) direkt herstellen,
ohne die Ladelogik mitzutesten — die hat ihre eigene Spec.

### Effects

Ein `effect` läuft nicht sofort, sondern beim nächsten Change-Detection-Zyklus.
Im Test löst man ihn mit **`TestBed.tick()`** aus. (`TestBed.flushEffects()` aus
dem Arbeitsblatt ist in Angular 22 als veraltet markiert.)

### `localStorage` ersetzen: `vi.stubGlobal`

Das Arbeitsblatt schlägt `vi.spyOn(Storage.prototype, 'setItem')` vor. Das ist
hier eine Falle, weil sich die Testumgebungen unterscheiden. Gemessen:

| Variante                                 | lokal (jsdom hat `localStorage`)                  | CI (Node 26, kein `localStorage`) |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `vi.spyOn(Storage.prototype, 'setItem')` | grün                                              | **rot**                           |
| `vi.spyOn(localStorage, 'setItem')`      | **rot** — jsdom legt die Zuweisung als Eintrag an | grün                              |
| `vi.stubGlobal('localStorage', fake)`    | grün                                              | grün                              |

`src/test-setup.ts` erklärt den Hintergrund: Node 22 und Node 26 verhalten sich beim
globalen `localStorage` unterschiedlich — die CI lief schon einmal in diese Falle.
Darum ersetzen die Specs `localStorage` komplett (`vi.stubGlobal`) und räumen mit
`vi.unstubAllGlobals()` in `afterEach` auf. Dasselbe Verfahren deckt auch den
Fehlerfall ab (`setItem` wirft `QuotaExceededError`, `getItem` wirft
`SecurityError`).

### Randfälle

Zu jedem Verhalten gehört mindestens der unangenehme Fall: `null`/Müll/leere
Listen am Gateway, unbekannter gespeicherter Autor im Store, `setItem`, das
wirft, HTML im Titel (muss als Text erscheinen, nicht als Element).

## Wie man weiß, dass die Tests etwas taugen

Ein grüner Test beweist nur, dass er nicht fehlschlug. Darum wurde jede neue
Spec mit **Mutationstests von Hand** geprüft: den Produktivcode gezielt kaputt
machen (falsche ID emittieren, Filter ignorieren, `setItem` entfernen, …) und
verlangen, dass mindestens ein Test rot wird.

| Spec                         | Mutationen | erkannt |
| ---------------------------- | ---------- | ------- |
| `blog-card.spec.ts`          | 11         | 11      |
| `blog-state-service.spec.ts` | 8          | 8       |
| `theme-service.spec.ts`      | 10         | 10      |
| `blog-list.spec.ts`          | 12         | 12      |
| `blog-service.spec.ts` (neu) | 2          | 2       |

## Coverage: ein blinder Fleck

`ng test --coverage` zählt nur Dateien, die ein Test tatsächlich lädt. Dateien,
die kein Test importiert, fehlen im Bericht ganz — die Prozentzahl ist dann
schöner als die Wirklichkeit. Zum Zeitpunkt dieser Arbeit waren das 25 Dateien
mit 1056 Zeilen. `coverageInclude: ['src/app/**/*.ts']` in `angular.json` würde
sie sichtbar machen; das ist bewusst nicht Teil dieses Änderungssatzes, weil es
die ausgewiesenen Zahlen der CI verschiebt.

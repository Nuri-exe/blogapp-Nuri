import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'blogapp.theme';
const DARK_CLASS = 'dark-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  // null means "follow the system preference"; a concrete value is the user's override.
  private readonly override = signal<ThemeMode | null>(this.readStoredOverride());

  // Live mirror of the OS preference, kept in sync via matchMedia listener.
  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly mode = computed<ThemeMode>(() => {
    const o = this.override();
    if (o) return o;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  readonly isDark = computed(() => this.mode() === 'dark');
  readonly followsSystem = computed(() => this.override() === null);

  constructor() {
    this.listenForSystemChanges();

    // Reflect mode → DOM (body class for Material colors, html attribute for the
    // prefers-color-scheme escape hatch in styles.scss).
    effect(() => {
      const isDark = this.isDark();
      const body = this.document.body;
      const html = this.document.documentElement;

      body.classList.toggle(DARK_CLASS, isDark);

      const override = this.override();
      if (override === null) {
        html.removeAttribute('data-theme-override');
      } else {
        html.setAttribute('data-theme-override', override);
      }
    });
  }

  toggle(): void {
    this.override.set(this.isDark() ? 'light' : 'dark');
    this.persist();
  }

  setMode(mode: ThemeMode): void {
    this.override.set(mode);
    this.persist();
  }

  useSystem(): void {
    this.override.set(null);
    this.removeStored();
  }

  private persist(): void {
    const value = this.override();
    if (value === null) {
      this.removeStored();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // localStorage may be unavailable (SSR, privacy mode) — fail silently.
    }
  }

  private removeStored(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // see persist()
    }
  }

  private readStoredOverride(): ThemeMode | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'dark' || v === 'light' ? v : null;
    } catch {
      return null;
    }
  }

  private readSystemPrefersDark(): boolean {
    const win = this.document.defaultView;
    return win?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenForSystemChanges(): void {
    const win = this.document.defaultView;
    const mql = win?.matchMedia?.('(prefers-color-scheme: dark)');
    mql?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
  }
}

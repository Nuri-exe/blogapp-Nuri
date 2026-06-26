import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'blog-theme-preference';
const DARK_CLASS = 'dark-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  // What the user picked. 'system' means follow prefers-color-scheme.
  private readonly mode = signal<ThemeMode>(this.readStoredMode());

  // Live mirror of the OS preference so 'system' mode reacts to OS changes.
  private readonly systemPrefersDark = signal(this.matchesDark());

  // Effective dark/light decision after merging user choice with OS pref.
  readonly isDark = computed(() => {
    const current = this.mode();
    return current === 'system' ? this.systemPrefersDark() : current === 'dark';
  });

  readonly currentMode = this.mode.asReadonly();

  constructor() {
    this.listenForSystemChanges();

    effect(() => {
      const root = this.document.documentElement;
      root.classList.toggle(DARK_CLASS, this.isDark());
      root.style.colorScheme = this.isDark() ? 'dark' : 'light';
    });
  }

  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage may be unavailable (private mode, SSR) — silently ignore.
    }
  }

  private readStoredMode(): ThemeMode {
    try {
      const value = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark' || value === 'system') {
        return value;
      }
    } catch {
      // ignored
    }
    return 'system';
  }

  private matchesDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenForSystemChanges(): void {
    const mql = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    mql?.addEventListener?.('change', (event) => this.systemPrefersDark.set(event.matches));
  }
}

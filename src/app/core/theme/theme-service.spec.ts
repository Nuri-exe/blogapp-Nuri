import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ThemeService } from './theme-service';

const STORAGE_KEY = 'blogapp.theme';
const DARK_CLASS = 'dark-theme';
const OVERRIDE_ATTRIBUTE = 'data-theme-override';

type ChangeListener = (event: { matches: boolean }) => void;

/**
 * ThemeService reads the OS preference through `document.defaultView.matchMedia`
 * and keeps listening for changes. jsdom has no matchMedia, so the test installs
 * a stand-in on the window and plays the part of the operating system.
 */
function mockSystemTheme(prefersDark: boolean) {
  const listeners = new Set<ChangeListener>();
  const query = {
    matches: prefersDark,
    addEventListener: (_type: 'change', listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: 'change', listener: ChangeListener) => listeners.delete(listener),
  };

  (document.defaultView as Window).matchMedia = vi.fn(
    () => query,
  ) as unknown as Window['matchMedia'];

  return {
    /** The user flips their OS between light and dark while the app is open. */
    changeTo(dark: boolean): void {
      query.matches = dark;
      for (const listener of listeners) listener({ matches: dark });
    },
  };
}

/** Installs a storage that is guaranteed to exist and records what it was asked. */
function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('ThemeService', () => {
  function createService(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    delete (document.defaultView as { matchMedia?: unknown }).matchMedia;
    document.body.classList.remove(DARK_CLASS);
    document.documentElement.removeAttribute(OVERRIDE_ATTRIBUTE);
  });

  describe('which mode wins', () => {
    it('follows the system preference when nothing is stored', () => {
      stubStorage();
      mockSystemTheme(true);

      const theme = createService();

      expect(theme.mode()).toBe('dark');
      expect(theme.isDark()).toBe(true);
      expect(theme.followsSystem()).toBe(true);
    });

    it('is light when the system says light, or says nothing at all', () => {
      stubStorage();
      // No matchMedia installed: the optional chaining must not blow up.
      expect(createService().mode()).toBe('light');
    });

    it('prefers a stored choice over the system preference', () => {
      stubStorage({ [STORAGE_KEY]: 'light' });
      mockSystemTheme(true);

      const theme = createService();

      expect(theme.mode()).toBe('light');
      expect(theme.followsSystem()).toBe(false);
    });

    it('ignores a stored value it does not know', () => {
      stubStorage({ [STORAGE_KEY]: 'purple' });
      mockSystemTheme(false);

      const theme = createService();

      expect(theme.mode()).toBe('light');
      expect(theme.followsSystem()).toBe(true);
    });
  });

  describe('user actions', () => {
    it('toggle() flips the mode and remembers the choice', () => {
      const storage = stubStorage();
      mockSystemTheme(false);
      const theme = createService();

      theme.toggle();

      expect(theme.mode()).toBe('dark');
      expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'dark');

      theme.toggle();

      expect(theme.mode()).toBe('light');
      expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, 'light');
    });

    it('setMode() pins the given mode regardless of the system', () => {
      const storage = stubStorage();
      mockSystemTheme(true);
      const theme = createService();

      theme.setMode('light');

      expect(theme.mode()).toBe('light');
      expect(theme.followsSystem()).toBe(false);
      expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'light');
    });

    it('useSystem() drops the override and the stored value', () => {
      const storage = stubStorage({ [STORAGE_KEY]: 'light' });
      mockSystemTheme(true);
      const theme = createService();
      expect(theme.mode()).toBe('light');

      theme.useSystem();

      expect(theme.mode()).toBe('dark');
      expect(theme.followsSystem()).toBe(true);
      expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('live system changes', () => {
    it('re-evaluates when the OS flips while the user follows it', () => {
      stubStorage();
      const system = mockSystemTheme(false);
      const theme = createService();
      expect(theme.mode()).toBe('light');

      system.changeTo(true);

      expect(theme.mode()).toBe('dark');
    });

    it('does not let an OS change override the user’s explicit choice', () => {
      stubStorage({ [STORAGE_KEY]: 'light' });
      const system = mockSystemTheme(false);
      const theme = createService();

      system.changeTo(true);

      expect(theme.mode()).toBe('light');
    });
  });

  describe('DOM mirror (effect)', () => {
    it('adds the dark class to <body> once the effect has run', () => {
      stubStorage();
      mockSystemTheme(true);
      createService();
      expect(document.body.classList.contains(DARK_CLASS)).toBe(false);

      TestBed.tick();

      expect(document.body.classList.contains(DARK_CLASS)).toBe(true);
    });

    it('removes the dark class again when the mode flips back', () => {
      stubStorage();
      mockSystemTheme(true);
      const theme = createService();
      TestBed.tick();

      theme.setMode('light');
      TestBed.tick();

      expect(document.body.classList.contains(DARK_CLASS)).toBe(false);
    });

    it('pins <html> to an explicit choice and releases it when following the system', () => {
      stubStorage();
      mockSystemTheme(false);
      const theme = createService();
      TestBed.tick();
      // Following the system: nothing pinned, so prefers-color-scheme can apply.
      expect(document.documentElement.hasAttribute(OVERRIDE_ATTRIBUTE)).toBe(false);

      theme.setMode('dark');
      TestBed.tick();
      expect(document.documentElement.getAttribute(OVERRIDE_ATTRIBUTE)).toBe('dark');

      theme.useSystem();
      TestBed.tick();
      expect(document.documentElement.hasAttribute(OVERRIDE_ATTRIBUTE)).toBe(false);
    });
  });

  describe('unavailable storage', () => {
    it('starts and toggles without throwing when the browser refuses all access', () => {
      const storage = stubStorage();
      const refuse = () => {
        throw new DOMException('Access is denied.', 'SecurityError');
      };
      storage.getItem.mockImplementation(refuse);
      storage.setItem.mockImplementation(refuse);
      storage.removeItem.mockImplementation(refuse);
      mockSystemTheme(false);

      expect(() => {
        const theme = createService();
        theme.toggle();
        theme.useSystem();
      }).not.toThrow();
    });
  });
});

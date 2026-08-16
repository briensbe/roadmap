import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'roadmap_theme_preference';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly mediaQuery =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // Signal indicating whether the OS is in dark mode
  readonly systemPrefersDark = signal<boolean>(this.mediaQuery?.matches ?? false);

  // Signal of user's chosen preference ('light' | 'dark' | 'system')
  readonly preference = signal<ThemePreference>(this.getInitialPreference());

  // Signal of the effective computed theme ('light' | 'dark')
  readonly effectiveTheme = computed<EffectiveTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  // Convenience computed boolean
  readonly isDarkMode = computed<boolean>(() => this.effectiveTheme() === 'dark');

  constructor() {
    // Listen for OS color scheme changes in real-time
    if (this.mediaQuery) {
      const listener = (e: MediaQueryListEvent) => {
        this.systemPrefersDark.set(e.matches);
      };
      this.mediaQuery.addEventListener('change', listener);
    }

    // Effect to apply/remove .dark-mode class on body & documentElement whenever effectiveTheme changes
    effect(() => {
      const isDark = this.effectiveTheme() === 'dark';
      if (typeof document !== 'undefined') {
        if (isDark) {
          document.body.classList.add('dark-mode');
          document.documentElement.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
          document.documentElement.classList.remove('dark-mode');
        }
      }
    });

    // Effect to sync preference to localStorage
    effect(() => {
      const pref = this.preference();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, pref);
        }
      } catch (e) {
        console.warn('Could not save theme preference to localStorage', e);
      }
    });
  }

  /**
   * Set user preference explicitly ('light' | 'dark' | 'system')
   */
  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
  }

  /**
   * Set theme (alias for setPreference for backwards compatibility)
   */
  setTheme(pref: ThemePreference): void {
    this.setPreference(pref);
  }

  /**
   * Quick toggle: switches between light and dark
   */
  toggleTheme(): void {
    const current = this.effectiveTheme();
    this.setPreference(current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Reads initial preference from localStorage or defaults to 'system'
   */
  private getInitialPreference(): ThemePreference {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          return stored;
        }
      }
    } catch (e) {
      console.warn('Could not read theme preference from localStorage', e);
    }
    return 'system';
  }
}

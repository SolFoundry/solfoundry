/**
 * useTheme - Theme management hook for dark/light mode toggle
 * 
 * Features:
 * - Persist theme preference in localStorage
 * - Respect system preference (prefers-color-scheme) as default
 * - Apply dark class to document.documentElement (Tailwind standard)
 * - Safe transition management with cleanup
 */
import { useState, useEffect, useCallback, useRef } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'solfoundry-theme';

/**
 * Get the system preference for color scheme
 */
function getSystemPreference(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the stored theme preference from localStorage
 */
function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply theme to the document using Tailwind's class strategy
 * Only toggles the 'dark' class - absence means light mode
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * useTheme hook
 * 
 * @returns {Object} - { theme, toggleTheme, setTheme }
 */
export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme();
    if (stored) return stored;
    return getSystemPreference();
  });

  // Track transition timeout to prevent race conditions
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track system preference listener
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryRef.current = mediaQuery;
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      // Clear any pending transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Set theme and save to localStorage
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, toggleTheme, setTheme };
}

export default useTheme;
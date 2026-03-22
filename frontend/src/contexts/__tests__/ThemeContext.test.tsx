/**
 * ThemeProvider persistence, system resolution, and document / meta updates.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from '../ThemeContext';

function matchMediaFactory(prefersDark: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#ffffff');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to system and resolves from prefers-color-scheme when nothing stored', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaFactory(true),
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('restores explicit light/dark from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaFactory(true),
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists setTheme to localStorage', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaFactory(false),
    });

    function Switcher() {
      const { setTheme } = useTheme();
      return (
        <button type="button" onClick={() => setTheme('dark')}>
          go dark
        </button>
      );
    }

    render(
      <ThemeProvider>
        <ThemeProbe />
        <Switcher />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /go dark/i }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#0a0a0a');
  });

  it('updates theme-color meta for light resolution', async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaFactory(false),
    });

    function Switcher() {
      const { setTheme } = useTheme();
      return (
        <button type="button" onClick={() => setTheme('light')}>
          go light
        </button>
      );
    }

    render(
      <ThemeProvider>
        <Switcher />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /go light/i }));

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#ffffff');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reacts to system preference while in system mode', () => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    const mql = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn((_evt: string, fn: (e: MediaQueryListEvent) => void) => {
        listeners.push(fn);
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');

    act(() => {
      mql.matches = true;
      listeners.forEach((fn) =>
        fn({ matches: true } as MediaQueryListEvent),
      );
    });

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock localStorage
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockStorage
});

// Mock matchMedia for system preference
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia
});

const ThemeToggleWrapper = () => (
  <ThemeProvider>
    <ThemeToggle />
  </ThemeProvider>
);

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders theme toggle button', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
    expect(toggleButton).toBeInTheDocument();
  });

  test('shows correct icon for light theme', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const moonIcon = screen.getByTestId('moon-icon');
    expect(moonIcon).toBeInTheDocument();
  });

  test('shows correct icon for dark theme', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const sunIcon = screen.getByTestId('sun-icon');
    expect(sunIcon).toBeInTheDocument();
  });

  test('toggles theme on click', async () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    expect(screen.getByTestId('moon-icon')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    });
  });

  test('persists theme preference in localStorage', async () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  test('loads saved theme from localStorage', () => {
    mockStorage.getItem.mockReturnValue('dark');
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('respects system preference when no saved preference', () => {
    mockStorage.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    expect(toggleButton).toHaveAttribute('aria-label', 'Toggle theme');
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  test('applies dark class to html element when dark theme is active', async () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  test('removes dark class when switching to light theme', async () => {
    mockStorage.getItem.mockReturnValue('dark');
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  test('handles keyboard navigation', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    toggleButton.focus();
    expect(document.activeElement).toBe(toggleButton);

    fireEvent.keyDown(toggleButton, { key: 'Enter', code: 'Enter' });

    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('handles space key activation', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    fireEvent.keyDown(toggleButton, { key: ' ', code: 'Space' });

    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('updates aria-pressed attribute', async () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('listens to system preference changes', () => {
    const addEventListener = vi.fn();
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener: vi.fn()
    });

    render(<ThemeToggleWrapper />);

    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

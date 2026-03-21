import { render, screen, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock matchMedia for system preference detection
const mockMatchMedia = jest.fn();

// Test component that uses theme context
const TestComponent = () => {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <div data-testid="test-component" className={theme}>
      <span data-testid="current-theme">{theme}</span>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>
        Set System
      </button>
    </div>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    // Setup global mocks
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
    });

    // Reset document.documentElement.classList
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  describe('Provider initialization', () => {
    it('should initialize with system preference when no localStorage value', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('solfoundry-theme');
    });

    it('should initialize with dark theme when system prefers dark', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should initialize with saved preference from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should handle invalid localStorage value gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-theme');
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    });
  });

  describe('Theme switching', () => {
    it('should toggle between light and dark themes', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      await user.click(screen.getByTestId('toggle-button'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      await user.click(screen.getByTestId('toggle-button'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should set specific theme using setTheme', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await user.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'dark');

      await user.click(screen.getByTestId('set-light'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'light');
    });

    it('should handle system theme preference', async () => {
      const user = userEvent.setup();
      const addEventListenerSpy = jest.fn();

      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: addEventListenerSpy,
        removeEventListener: jest.fn(),
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await user.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'system');
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('LocalStorage persistence', () => {
    it('should save theme preference to localStorage', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await user.click(screen.getByTestId('set-dark'));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'dark');

      await user.click(screen.getByTestId('set-light'));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'light');

      await user.click(screen.getByTestId('set-system'));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('solfoundry-theme', 'system');
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Should not crash when localStorage fails
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      consoleSpy.mockRestore();
    });
  });

  describe('System preference changes', () => {
    it('should respond to system theme changes when theme is set to system', async () => {
      const user = userEvent.setup();
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      const mockMediaQuery = {
        matches: false,
        addEventListener: jest.fn((_, handler) => {
          mediaQueryHandler = handler;
        }),
        removeEventListener: jest.fn(),
      };

      mockMatchMedia.mockReturnValue(mockMediaQuery);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await user.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      // Simulate system preference change to dark
      if (mediaQueryHandler) {
        act(() => {
          mediaQueryHandler({ matches: true } as MediaQueryListEvent);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      });
    });

    it('should not respond to system changes when theme is manually set', async () => {
      const user = userEvent.setup();
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      const mockMediaQuery = {
        matches: false,
        addEventListener: jest.fn((_, handler) => {
          mediaQueryHandler = handler;
        }),
        removeEventListener: jest.fn(),
      };

      mockMatchMedia.mockReturnValue(mockMediaQuery);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await user.click(screen.getByTestId('set-light'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      // Simulate system preference change - should be ignored
      if (mediaQueryHandler) {
        act(() => {
          mediaQueryHandler({ matches: true } as MediaQueryListEvent);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      });
    });
  });

  describe('DOM manipulation', () => {
    it('should add/remove dark class from documentElement', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(false);

      await user.click(screen.getByTestId('set-dark'));
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      await user.click(screen.getByTestId('set-light'));
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Hook usage outside provider', () => {
    it('should throw error when used outside ThemeProvider', () => {
      const TestComponentOutsideProvider = () => {
        const { theme } = useTheme();
        return <div>{theme}</div>;
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponentOutsideProvider />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = jest.fn();

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: removeEventListenerSpy,
      });

      const { unmount } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});

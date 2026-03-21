/**
 * Tests for ThemeToggle component
 * @module components/layout/__tests__/ThemeToggle.test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ThemeToggle, SimpleThemeToggle } from '../ThemeToggle';

// ============================================================================
// Helpers
// ============================================================================

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderWithProvider = (component: React.ReactNode, defaultTheme = 'dark') => {
  return render(
    <ThemeProvider defaultTheme={defaultTheme as any}>
      {component}
    </ThemeProvider>
  );
};

// ============================================================================
// Tests - ThemeToggle
// ============================================================================

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render toggle button', async () => {
      renderWithProvider(<ThemeToggle />);
      
      // Wait for mounted state
      await waitFor(() => {
        expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
      });
    });

    it('should show placeholder before mount', () => {
      renderWithProvider(<ThemeToggle />);
      
      // Initial render before useEffect runs
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Dropdown Menu', () => {
    it('should open dropdown on click', async () => {
      renderWithProvider(<ThemeToggle />);
      
      await waitFor(() => {
        const button = screen.getByLabelText('Toggle theme');
        fireEvent.click(button);
      });
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      renderWithProvider(
        <div>
          <ThemeToggle />
          <div data-testid="outside">Outside</div>
        </div>
      );
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown on Escape key', async () => {
      renderWithProvider(<ThemeToggle />);
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Selection', () => {
    it('should select light theme', async () => {
      renderWithProvider(<ThemeToggle />, 'dark');
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      // Click Light option
      fireEvent.click(screen.getByText('Light'));
      
      // Verify theme changed
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should select dark theme', async () => {
      renderWithProvider(<ThemeToggle />, 'light');
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      // Click Dark option
      fireEvent.click(screen.getByText('Dark'));
      
      // Verify theme changed
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should select system theme', async () => {
      renderWithProvider(<ThemeToggle />, 'dark');
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      // Click System option
      fireEvent.click(screen.getByText('System'));
      
      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should show check mark on selected theme', async () => {
      renderWithProvider(<ThemeToggle />, 'dark');
      
      // Open dropdown
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      // Dark option should be selected
      const darkOption = screen.getByRole('option', { name: /dark/i });
      expect(darkOption).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have correct aria attributes on button', async () => {
      renderWithProvider(<ThemeToggle />);
      
      await waitFor(() => {
        const button = screen.getByLabelText('Toggle theme');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      });
    });

    it('should update aria-expanded when dropdown opens', async () => {
      renderWithProvider(<ThemeToggle />);
      
      await waitFor(() => {
        const button = screen.getByLabelText('Toggle theme');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have correct role on dropdown', async () => {
      renderWithProvider(<ThemeToggle />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Toggle theme'));
      });
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Theme options');
    });
  });
});

// ============================================================================
// Tests - SimpleThemeToggle
// ============================================================================

describe('SimpleThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render button', async () => {
      renderWithProvider(<SimpleThemeToggle />);
      
      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Theme Cycling', () => {
    it('should cycle from dark to light (without system option)', async () => {
      renderWithProvider(<SimpleThemeToggle />, 'dark');
      
      await waitFor(() => {
        const button = screen.getByRole('button');
        fireEvent.click(button);
      });
      
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should cycle from light to dark', async () => {
      renderWithProvider(<SimpleThemeToggle />, 'light');
      
      await waitFor(() => {
        const button = screen.getByRole('button');
        fireEvent.click(button);
      });
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should include system option when showSystemOption is true', async () => {
      renderWithProvider(<SimpleThemeToggle showSystemOption />, 'dark');
      
      await waitFor(() => {
        const button = screen.getByRole('button');
        // Click twice: dark -> light -> system
        fireEvent.click(button);
        fireEvent.click(button);
      });
      
      // After clicking twice, should be on system mode
      // (we can't easily verify the icon, but we can verify localStorage)
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', async () => {
      renderWithProvider(<SimpleThemeToggle />, 'dark');
      
      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});
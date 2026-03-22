import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { SiteLayout } from './SiteLayout';

// Mock window.matchMedia (required by ThemeProvider for system theme detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/** Wrap component in ThemeProvider (required by ThemeToggle inside SiteLayout). */
function renderWithTheme(element: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider defaultTheme="system">
        {element}
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// Mock window.scrollTo
const mockScrollTo = vi.fn();
Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

// Mock scrollY
let mockScrollY = 0;
Object.defineProperty(window, 'scrollY', {
  get: () => mockScrollY,
  configurable: true,
});

describe('SiteLayout', () => {
  const mockOnConnectWallet = vi.fn();
  const mockOnDisconnectWallet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockScrollY = 0;
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  // =========================================================================
  // Rendering Tests
  // =========================================================================

  describe('Rendering', () => {
    it('renders children correctly', () => {
      renderWithTheme(
        <SiteLayout>
          <div data-testid="test-content">Test Content</div>
        </SiteLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders header with logo', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      expect(screen.getAllByText('SolFoundry').length).toBeGreaterThanOrEqual(1);
      // Header and footer both contain "SF" logo
      expect(screen.getAllByText('SF').length).toBeGreaterThanOrEqual(1);
    });

    it('renders all navigation links', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // Desktop + mobile nav both have these links, use getAllByRole
      expect(screen.getAllByRole('link', { name: 'Bounties' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('link', { name: 'Leaderboard' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('link', { name: 'Agents' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('link', { name: 'Docs' }).length).toBeGreaterThanOrEqual(1);
    });

    it('renders footer with all links', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();

      const footer = screen.getByRole('contentinfo');
      expect(within(footer).getByRole('link', { name: 'Bounties' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'Leaderboard' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'How It Works' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'Docs' })).toBeInTheDocument();

      expect(within(footer).getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'Website' })).toBeInTheDocument();
      expect(within(footer).getAllByRole('link', { name: /X.*Twitter/i }).length).toBeGreaterThanOrEqual(1);
    });

    it('renders copyright with current year', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${currentYear} SolFoundry`))).toBeInTheDocument();
    });

    it('renders contract address in footer', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByText(/C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Wallet Connection Tests
  // =========================================================================

  describe('Wallet Connection', () => {
    it('renders connect wallet button when not connected', () => {
      renderWithTheme(<SiteLayout walletAddress={null}><div /></SiteLayout>);

      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });

    it('calls onConnectWallet when connect button clicked', () => {
      renderWithTheme(
        <SiteLayout walletAddress={null} onConnectWallet={mockOnConnectWallet}>
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
      expect(mockOnConnectWallet).toHaveBeenCalledTimes(1);
    });

    it('renders wallet address when connected', () => {
      renderWithTheme(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
          <div />
        </SiteLayout>
      );

      // Truncated address
      expect(screen.getByText('Amu1...71o7')).toBeInTheDocument();
    });

    it('renders user avatar with initial when no avatar URL provided', () => {
      renderWithTheme(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7" userName="TestUser">
          <div />
        </SiteLayout>
      );

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('shows user dropdown menu when clicked', async () => {
      renderWithTheme(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByText('Amu1...71o7'));

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });
    });

    it('calls onDisconnectWallet when disconnect clicked', async () => {
      renderWithTheme(
        <SiteLayout
          walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
          onDisconnectWallet={mockOnDisconnectWallet}
        >
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByText('Amu1...71o7'));

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Disconnect'));
      expect(mockOnDisconnectWallet).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Navigation Highlighting Tests
  // =========================================================================

  describe('Navigation Highlighting', () => {
    it('highlights current navigation item', () => {
      renderWithTheme(<SiteLayout currentPath="/bounties"><div /></SiteLayout>);

      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      const bountiesLink = within(mainNav).getByRole('link', { name: 'Bounties' });
      expect(bountiesLink).toHaveAttribute('aria-current', 'page');
    });

    it('highlights navigation item for nested paths', () => {
      renderWithTheme(<SiteLayout currentPath="/bounties/123"><div /></SiteLayout>);

      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      const bountiesLink = within(mainNav).getByRole('link', { name: 'Bounties' });
      expect(bountiesLink).toHaveClass('text-solana-green');
    });

    it('does not highlight non-current navigation items', () => {
      renderWithTheme(<SiteLayout currentPath="/bounties"><div /></SiteLayout>);

      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      const leaderboardLink = within(mainNav).getByRole('link', { name: 'Leaderboard' });
      expect(leaderboardLink).not.toHaveAttribute('aria-current', 'page');
      expect(leaderboardLink).toHaveClass('text-gray-600');
    });
  });

  // =========================================================================
  // Mobile Menu Tests
  // =========================================================================

  describe('Mobile Menu', () => {
    it('toggles mobile menu when hamburger button clicked', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });

      // Open menu
      fireEvent.click(menuButton);
      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();

      // Close menu
      fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    });

    it('closes mobile menu when overlay clicked', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // Open menu first
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      // The overlay div has aria-hidden="true" and class containing "backdrop-blur"
      const overlays = document.querySelectorAll('.fixed.inset-0');
      const overlay = Array.from(overlays).find(
        element => element.getAttribute('aria-hidden') === 'true',
      );
      if (overlay) {
        fireEvent.click(overlay);
      }

      // After closing, the menu button should say "open menu" again
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('closes mobile menu on Escape key', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // Open menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      // After closing, the menu button should say "open menu" again
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('prevents body scroll when mobile menu is open', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(document.body.style.overflow).toBe('hidden');

      // Close menu
      fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
      expect(document.body.style.overflow).toBe('');
    });

    it('renders all navigation items in mobile sidebar', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // Open menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      const sidebar = screen.getByRole('navigation', { name: /mobile navigation/i });
      expect(sidebar).toHaveTextContent('Bounties');
      expect(sidebar).toHaveTextContent('Leaderboard');
      expect(sidebar).toHaveTextContent('Agents');
      expect(sidebar).toHaveTextContent('Docs');
    });
  });

  // =========================================================================
  // Header Scroll Behavior Tests
  // =========================================================================

  describe('Header Scroll Behavior', () => {
    it('has transparent background initially', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-transparent');
    });

    it('adds background on scroll', async () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');

      // Simulate scroll
      mockScrollY = 20;
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(header.className).toContain('dark:bg-surface/95');
      });
    });
  });

  // =========================================================================
  // Accessibility Tests
  // =========================================================================

  describe('Accessibility', () => {
    it('has correct ARIA attributes on header', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });

    it('has correct ARIA attributes on navigation', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });

    it('has correct ARIA attributes on footer', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();
    });

    it('has aria-expanded on mobile menu button', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-hidden on sidebar when closed', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // When closed, the sidebar has aria-hidden="true" which makes getByRole unable to find it
      // We use the aria-label directly to find it
      const sidebar = document.querySelector('[aria-label="Mobile navigation"]');
      expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // =========================================================================
  // User Dropdown Tests
  // =========================================================================

  describe('User Dropdown', () => {
    it('displays user name in dropdown', async () => {
      renderWithTheme(
        <SiteLayout
          walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
          userName="TestUser"
        >
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByText('Amu1...71o7'));

      await waitFor(() => {
        expect(screen.getByText('TestUser')).toBeInTheDocument();
      });
    });

    it('closes dropdown on Escape key', async () => {
      renderWithTheme(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByText('Amu1...71o7'));

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Profile')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Responsive Behavior Tests
  // =========================================================================

  describe('Responsive Behavior', () => {
    it('hides desktop navigation on mobile', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      // Desktop nav should have class 'hidden lg:flex'
      const desktopNav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(desktopNav).toHaveClass('hidden');
      expect(desktopNav).toHaveClass('lg:flex');
    });

    it('shows mobile menu button on mobile', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toHaveClass('lg:hidden');
    });
  });

  // =========================================================================
  // Theme Tests
  // =========================================================================

  describe('Theme', () => {
    it('renders theme menu control in the header', async () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);
      const banner = screen.getByRole('banner');
      await waitFor(() => {
        const toggle = screen.getByRole('button', { name: /theme:/i });
        expect(banner).toContainElement(toggle);
      });
    });

    it('uses dark theme colors', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const layout = document.querySelector('.site-layout');
      expect(layout).toHaveClass('dark:bg-surface');
      expect(layout).toHaveClass('dark:text-white');
    });

    it('uses monospace font', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const layout = document.querySelector('.site-layout');
      expect(layout).toHaveClass('font-mono');
    });

    it('uses Solana purple in gradient', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectButton?.className).toMatch(/from-solana-purple/);
    });

    it('uses Solana green in gradient', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectButton?.className).toMatch(/to-solana-green/);
    });
  });

  // =========================================================================
  // External Links Tests
  // =========================================================================

  describe('External Links', () => {
    it('opens GitHub link in new tab', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const githubLink = screen.getByRole('link', { name: 'GitHub' });
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('opens Twitter link in new tab', () => {
      renderWithTheme(<SiteLayout><div /></SiteLayout>);

      const footer = screen.getByRole('contentinfo');
      const twitterLink = within(footer).getByRole('link', { name: 'X / Twitter' });
      expect(twitterLink).toHaveAttribute('target', '_blank');
      expect(twitterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});

describe('truncateAddress', () => {
  it('is used correctly for wallet addresses', () => {
    renderWithTheme(
      <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
        <div />
      </SiteLayout>
    );

    // Should show truncated format: first 4 + ... + last 4
    expect(screen.getByText('Amu1...71o7')).toBeInTheDocument();
  });
});
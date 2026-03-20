import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SiteLayout } from './SiteLayout';

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
      render(
        <SiteLayout>
          <div data-testid="test-content">Test Content</div>
        </SiteLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders header with logo', () => {
      render(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByText('SolFoundry')).toBeInTheDocument();
      expect(screen.getByText('SF')).toBeInTheDocument();
    });

    it('renders all navigation links', () => {
      render(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByRole('link', { name: 'Bounties' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Agents' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
    });

    it('renders footer with all links', () => {
      render(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'CA' })).toBeInTheDocument();
    });

    it('renders copyright with current year', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${currentYear} SolFoundry`))).toBeInTheDocument();
    });

    it('renders contract address in footer', () => {
      render(<SiteLayout><div /></SiteLayout>);

      expect(screen.getByText(/Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Wallet Connection Tests
  // =========================================================================

  describe('Wallet Connection', () => {
    it('renders connect wallet button when not connected', () => {
      render(<SiteLayout walletAddress={null}><div /></SiteLayout>);

      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });

    it('calls onConnectWallet when connect button clicked', () => {
      render(
        <SiteLayout walletAddress={null} onConnectWallet={mockOnConnectWallet}>
          <div />
        </SiteLayout>
      );

      fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
      expect(mockOnConnectWallet).toHaveBeenCalledTimes(1);
    });

    it('renders wallet address when connected', () => {
      render(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
          <div />
        </SiteLayout>
      );

      // Truncated address
      expect(screen.getByText('Amu1...71o7')).toBeInTheDocument();
    });

    it('renders user avatar with initial when no avatar URL provided', () => {
      render(
        <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7" userName="TestUser">
          <div />
        </SiteLayout>
      );

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('shows user dropdown menu when clicked', async () => {
      render(
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
      render(
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
      render(<SiteLayout currentPath="/bounties"><div /></SiteLayout>);

      const bountiesLink = screen.getByRole('link', { name: 'Bounties' });
      expect(bountiesLink).toHaveAttribute('aria-current', 'page');
    });

    it('highlights navigation item for nested paths', () => {
      render(<SiteLayout currentPath="/bounties/123"><div /></SiteLayout>);

      const bountiesLink = screen.getByRole('link', { name: 'Bounties' });
      expect(bountiesLink).toHaveClass('text-[#14F195]');
    });

    it('does not highlight non-current navigation items', () => {
      render(<SiteLayout currentPath="/bounties"><div /></SiteLayout>);

      const leaderboardLink = screen.getByRole('link', { name: 'Leaderboard' });
      expect(leaderboardLink).not.toHaveAttribute('aria-current', 'page');
      expect(leaderboardLink).toHaveClass('text-gray-300');
    });
  });

  // =========================================================================
  // Mobile Menu Tests
  // =========================================================================

  describe('Mobile Menu', () => {
    it('toggles mobile menu when hamburger button clicked', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });

      // Open menu
      fireEvent.click(menuButton);
      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();

      // Close menu
      fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    });

    it('closes mobile menu when overlay clicked', () => {
      render(<SiteLayout><div /></SiteLayout>);

      // Open menu first
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      // Click overlay
      const overlay = document.querySelector('.bg-black\\/60');
      if (overlay) {
        fireEvent.click(overlay);
      }

      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).not.toBeVisible();
    });

    it('closes mobile menu on Escape key', () => {
      render(<SiteLayout><div /></SiteLayout>);

      // Open menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).not.toBeVisible();
    });

    it('prevents body scroll when mobile menu is open', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(document.body.style.overflow).toBe('hidden');

      // Close menu
      fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
      expect(document.body.style.overflow).toBe('');
    });

    it('renders all navigation items in mobile sidebar', () => {
      render(<SiteLayout><div /></SiteLayout>);

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
      render(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-transparent');
    });

    it('adds background on scroll', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');

      // Simulate scroll
      mockScrollY = 20;
      fireEvent.scroll(window);

      // Wait for state update
      waitFor(() => {
        expect(header).toHaveClass('bg-[#0a0a0a]/95');
      });
    });
  });

  // =========================================================================
  // Accessibility Tests
  // =========================================================================

  describe('Accessibility', () => {
    it('has correct ARIA attributes on header', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });

    it('has correct ARIA attributes on navigation', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });

    it('has correct ARIA attributes on footer', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();
    });

    it('has aria-expanded on mobile menu button', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-hidden on sidebar when closed', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const sidebar = screen.getByRole('navigation', { name: /mobile navigation/i });
      expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // =========================================================================
  // User Dropdown Tests
  // =========================================================================

  describe('User Dropdown', () => {
    it('displays user name in dropdown', async () => {
      render(
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
      render(
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
        expect(screen.queryByText('Profile')).not.toBeVisible();
      });
    });
  });

  // =========================================================================
  // Responsive Behavior Tests
  // =========================================================================

  describe('Responsive Behavior', () => {
    it('hides desktop navigation on mobile', () => {
      render(<SiteLayout><div /></SiteLayout>);

      // Desktop nav should have class 'hidden lg:flex'
      const desktopNav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(desktopNav).toHaveClass('hidden');
      expect(desktopNav).toHaveClass('lg:flex');
    });

    it('shows mobile menu button on mobile', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toHaveClass('lg:hidden');
    });
  });

  // =========================================================================
  // Theme Tests
  // =========================================================================

  describe('Theme', () => {
    it('uses dark theme colors', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const layout = document.querySelector('.site-layout');
      expect(layout).toHaveClass('bg-[#0a0a0a]');
      expect(layout).toHaveClass('text-white');
    });

    it('uses monospace font', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const layout = document.querySelector('.site-layout');
      expect(layout).toHaveClass('font-mono');
    });

    it('uses Solana purple (#9945FF) in gradient', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectButton?.className).toMatch(/from-\[#9945FF\]/);
    });

    it('uses Solana green (#14F195) in gradient', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectButton?.className).toMatch(/to-\[#14F195\]/);
    });
  });

  // =========================================================================
  // External Links Tests
  // =========================================================================

  describe('External Links', () => {
    it('opens GitHub link in new tab', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const githubLink = screen.getByRole('link', { name: 'GitHub' });
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('opens Twitter link in new tab', () => {
      render(<SiteLayout><div /></SiteLayout>);

      const twitterLink = screen.getByRole('link', { name: 'Twitter' });
      expect(twitterLink).toHaveAttribute('target', '_blank');
      expect(twitterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});

describe('truncateAddress', () => {
  it('is used correctly for wallet addresses', () => {
    render(
      <SiteLayout walletAddress="Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7">
        <div />
      </SiteLayout>
    );

    // Should show truncated format: first 4 + ... + last 4
    expect(screen.getByText('Amu1...71o7')).toBeInTheDocument();
  });
});
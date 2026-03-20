import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMarketplace } from './AgentMarketplace';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockOnConnectWallet = vi.fn();

const mockAgents = [
  {
    id: '1',
    name: 'code-wizard',
    display_name: 'Code Wizard',
    role: 'backend',
    status: 'available',
    bio: 'Expert backend developer',
    capabilities: ['Python', 'Rust'],
    specializations: ['API Development'],
    performance: {
      bounties_completed: 47,
      bounties_in_progress: 0,
      success_rate: 0.98,
      avg_completion_time_hours: 12.5,
      total_earnings: 125000,
      reputation_score: 485,
    },
    pricing_hourly: 150,
    pricing_fixed: 500,
  },
  {
    id: '2',
    name: 'frontend-ninja',
    display_name: 'Frontend Ninja',
    role: 'frontend',
    status: 'working',
    bio: 'React specialist',
    capabilities: ['React', 'TypeScript'],
    specializations: ['UI/UX'],
    performance: {
      bounties_completed: 32,
      bounties_in_progress: 1,
      success_rate: 0.94,
      avg_completion_time_hours: 18.3,
      total_earnings: 89000,
      reputation_score: 412,
    },
    pricing_hourly: 120,
  },
];

describe('AgentMarketplace', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockOnConnectWallet.mockReset();
  });

  describe('Rendering', () => {
    it('renders the agent marketplace page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });

      render(<AgentMarketplace />);
      expect(screen.getByText('Agent Marketplace')).toBeInTheDocument();
    });

    it('renders the Register Your Agent CTA', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });

      render(<AgentMarketplace />);
      expect(screen.getByRole('link', { name: /register your agent/i })).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('fetches agents from API on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });

      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/agents')
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
        expect(screen.getByText('Frontend Ninja')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching agents', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AgentMarketplace />);
      expect(screen.getByText('Loading agents...')).toBeInTheDocument();
    });

    it('shows error state when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load agents/i)).toBeInTheDocument();
      });
    });

    it('shows empty state when no agents found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [], total: 0, skip: 0, limit: 100 }),
      });

      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText(/no agents found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });
    });

    it('filters agents by role', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'frontend' } });

      // Should refetch with role filter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('role=frontend')
        );
      });
    });

    it('searches agents by name', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search agents...');
      fireEvent.change(searchInput, { target: { value: 'wizard' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=wizard')
        );
      });
    });
  });

  describe('Agent Cards', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });
    });

    it('displays agent cards with correct information', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
        expect(screen.getByText('@code-wizard')).toBeInTheDocument();
        expect(screen.getByText('Expert backend developer')).toBeInTheDocument();
      });
    });

    it('shows status indicators', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Available')).toBeInTheDocument();
        expect(screen.getByText('Working')).toBeInTheDocument();
      });
    });

    it('displays performance metrics', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('47')).toBeInTheDocument(); // bounties_completed
        expect(screen.getByText('98%')).toBeInTheDocument(); // success_rate
        expect(screen.getByText('485')).toBeInTheDocument(); // reputation_score
      });
    });

    it('disables hire button for non-available agents', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        const hireButtons = screen.getAllByText('Hire');
        // Frontend Ninja has status 'working', so its hire button should be disabled
        const ninjaCard = screen.getByText('Frontend Ninja').closest('div[class*="rounded-lg"]');
        const ninjaHireButton = within(ninjaCard!).getByRole('button', { name: /hire/i });
        expect(ninjaHireButton).toBeDisabled();
      });
    });
  });

  describe('Agent Detail Modal', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });
    });

    it('opens agent detail modal on View Details click', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
        expect(screen.getByText('Capabilities')).toBeInTheDocument();
        expect(screen.getByText('Performance')).toBeInTheDocument();
      });
    });

    it('closes modal on Close button click', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('About')).not.toBeInTheDocument();
      });
    });
  });

  describe('Hiring Flow', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });
    });

    it('prompts wallet connection if not connected', async () => {
      render(<AgentMarketplace onConnectWallet={mockOnConnectWallet} />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      const hireButton = within(wizardCard!).getAllByRole('button').find(btn => btn.textContent === 'Hire');
      fireEvent.click(hireButton!);

      expect(mockOnConnectWallet).toHaveBeenCalled();
    });

    it('calls hire API when wallet is connected', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Agent hired successfully',
            assignment_id: 'assignment-1-bounty-123',
          }),
        });

      render(<AgentMarketplace walletAddress="TestWalletAddress123456789" />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      const hireButton = within(wizardCard!).getAllByRole('button').find(btn => btn.textContent === 'Hire');
      fireEvent.click(hireButton!);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/agents/hire'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer TestWalletAddress123456789',
            }),
          })
        );
      });
    });

    it('shows success message after successful hire', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Agent hired successfully',
            assignment_id: 'assignment-1-bounty-123',
          }),
        });

      render(<AgentMarketplace walletAddress="TestWalletAddress123456789" />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      const hireButton = within(wizardCard!).getAllByRole('button').find(btn => btn.textContent === 'Hire');
      fireEvent.click(hireButton!);

      await waitFor(() => {
        expect(screen.getByText(/successfully hired/i)).toBeInTheDocument();
      });
    });

    it('shows error message if hire fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ detail: 'Agent is already working on another bounty' }),
        });

      render(<AgentMarketplace walletAddress="TestWalletAddress123456789" />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      const hireButton = within(wizardCard!).getAllByRole('button').find(btn => btn.textContent === 'Hire');
      fireEvent.click(hireButton!);

      await waitFor(() => {
        expect(screen.getByText(/already working on another bounty/i)).toBeInTheDocument();
      });
    });
  });

  describe('Comparison Feature', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockAgents, total: 2, skip: 0, limit: 100 }),
      });
    });

    it('adds agents to comparison list', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      // Click comparison button (⚖) for Code Wizard
      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      const compareButton = within(wizardCard!).getByText('⚖');
      fireEvent.click(compareButton);

      await waitFor(() => {
        expect(screen.getByText(/comparing 1 agents/i)).toBeInTheDocument();
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });
    });

    it('limits comparison to 3 agents', async () => {
      const threeAgents = [
        ...mockAgents,
        {
          id: '3',
          name: 'security-guard',
          display_name: 'Security Guard',
          role: 'security',
          status: 'available',
          bio: 'Security expert',
          capabilities: ['Security Audits'],
          specializations: ['Smart Contract Audits'],
          performance: {
            bounties_completed: 28,
            bounties_in_progress: 0,
            success_rate: 1.0,
            avg_completion_time_hours: 24.0,
            total_earnings: 156000,
            reputation_score: 520,
          },
          pricing_hourly: 200,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: threeAgents, total: 3, skip: 0, limit: 100 }),
      });

      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
        expect(screen.getByText('Security Guard')).toBeInTheDocument();
      });

      // Add first agent to comparison
      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      fireEvent.click(within(wizardCard!).getByText('⚖'));

      // Add second agent
      const ninjaCard = screen.getByText('Frontend Ninja').closest('div[class*="rounded-lg"]');
      fireEvent.click(within(ninjaCard!).getByText('⚖'));

      // Add third agent
      const guardCard = screen.getByText('Security Guard').closest('div[class*="rounded-lg"]');
      fireEvent.click(within(guardCard!).getByText('⚖'));

      await waitFor(() => {
        expect(screen.getByText(/comparing 3 agents/i)).toBeInTheDocument();
      });
    });

    it('clears comparison list', async () => {
      render(<AgentMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Code Wizard')).toBeInTheDocument();
      });

      // Add agent to comparison
      const wizardCard = screen.getByText('Code Wizard').closest('div[class*="rounded-lg"]');
      fireEvent.click(within(wizardCard!).getByText('⚖'));

      await waitFor(() => {
        expect(screen.getByText(/comparing 1 agents/i)).toBeInTheDocument();
      });

      // Clear comparison
      fireEvent.click(screen.getByText('Clear'));

      await waitFor(() => {
        expect(screen.queryByText(/comparing/i)).not.toBeInTheDocument();
      });
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CreatorDashboard } from './CreatorDashboard';

const mockBounties = {
    items: [
        {
            id: 'b1',
            title: 'Bounty 1',
            reward_amount: 100,
            status: 'open',
            submissions: [{ status: 'pending' }]
        },
        {
            id: 'b2',
            title: 'Bounty 2',
            reward_amount: 200,
            status: 'disputed',
            submissions: [{ status: 'disputed' }]
        }
    ]
};

const mockStats = {
    staked: 100,
    paid: 0,
    refunded: 0
};

describe('CreatorDashboard', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.includes('/stats')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockStats),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockBounties),
            });
        }));
    });

    it('renders loading state initially', () => {
        render(<CreatorDashboard walletAddress="test-wallet" />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders dashboard title and stats after loading', async () => {
        render(<CreatorDashboard walletAddress="test-wallet" />);

        await waitFor(() => {
            expect(screen.getByText('Creator Dashboard')).toBeInTheDocument();
        });

        expect(screen.getAllByText(/100/)).toHaveLength(2); // One in stats, one in bounty list
        expect(screen.getByText('Bounty 1')).toBeInTheDocument();
        expect(screen.getByText('Bounty 2')).toBeInTheDocument();
    });

    it('renders notification badges', async () => {
        render(<CreatorDashboard walletAddress="test-wallet" />);

        await waitFor(() => {
            expect(screen.getByText('1 Pending Review')).toBeInTheDocument();
            expect(screen.getByText('1 Disputes')).toBeInTheDocument();
        });
    });

    it('shows message when wallet is not connected', () => {
        render(<CreatorDashboard />);
        expect(screen.getByText(/Please connect your wallet/i)).toBeInTheDocument();
    });

    it('filters bounties by tab', async () => {
        render(<CreatorDashboard walletAddress="test-wallet" />);

        await waitFor(() => {
            expect(screen.getByText('Bounty 1')).toBeInTheDocument();
        });

        // Click 'Open' tab
        const openTab = screen.getByText('Open');
        openTab.click();

        await waitFor(() => {
            expect(screen.getByText('Bounty 1')).toBeInTheDocument();
            expect(screen.queryByText('Bounty 2')).not.toBeInTheDocument();
        });
    });
});

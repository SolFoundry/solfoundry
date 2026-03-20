import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorBountyCard } from './CreatorBountyCard';

const mockBounty = {
    id: 'b1',
    title: 'Test Bounty',
    reward_amount: 100,
    status: 'open',
    deadline: '2026-12-31T23:59:59Z',
    submission_count: 1,
    submissions: [
        {
            id: 's1',
            submitted_by: 'alice-wallet',
            submitted_at: '2026-03-20T22:00:00Z',
            pr_url: 'https://github.com/org/repo/pull/1',
            status: 'pending',
            ai_score: 0.85,
            notes: 'Test notes'
        }
    ]
};

describe('CreatorBountyCard', () => {
    const onUpdate = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });

    it('renders bounty details correctly', () => {
        render(<CreatorBountyCard bounty={mockBounty} onUpdate={onUpdate} />);

        expect(screen.getByText('Test Bounty')).toBeInTheDocument();
        expect(screen.getByText('100 FNDRY')).toBeInTheDocument();
    });

    it('expands to show submissions when clicked', async () => {
        render(<CreatorBountyCard bounty={mockBounty} onUpdate={onUpdate} />);

        const viewButton = screen.getByText(/View Submissions/i);
        fireEvent.click(viewButton);

        const hideButton = await screen.findByText(/Hide Submissions/i);
        expect(hideButton).toBeInTheDocument();
        expect(screen.getByText('Submission Feed')).toBeInTheDocument();
        expect(screen.getByText('Test notes')).toBeInTheDocument();
    });

    it('triggers approve action', async () => {
        render(<CreatorBountyCard bounty={mockBounty} onUpdate={onUpdate} />);

        fireEvent.click(screen.getByText(/View Submissions/i));
        const approveButton = await screen.findByText('Approve');
        fireEvent.click(approveButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/submissions/s1'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'approved' })
                })
            );
        });
    });

    it('triggers cancel action with confirmation', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        render(<CreatorBountyCard bounty={mockBounty} onUpdate={onUpdate} />);

        // Open action menu (Actions toggle)
        const actionsButton = screen.getByText(/Actions/i);
        fireEvent.click(actionsButton);

        const cancelButton = screen.getByText(/Cancel & Refund/i);
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/cancel'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    it('shows View Winner Profile link for paid submissions', async () => {
        const paidBounty = {
            ...mockBounty,
            submissions: [{ ...mockBounty.submissions[0], status: 'paid' }]
        };
        render(<CreatorBountyCard bounty={paidBounty} onUpdate={onUpdate} />);

        fireEvent.click(screen.getByText(/View Submissions/i));
        expect(await screen.findByText(/View Winner Profile/i)).toBeInTheDocument();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BountiesPage } from '../pages/BountiesPage';
import { BountyBoard } from '../components/bounties/BountyBoard';
import { BountyCard, formatTimeRemaining, formatReward } from '../components/bounties/BountyCard';
import { TierBadge } from '../components/bounties/TierBadge';
import { StatusIndicator } from '../components/bounties/StatusIndicator';
import { EmptyState } from '../components/bounties/EmptyState';
import { useBountyBoard } from '../hooks/useBountyBoard';
import { mockBounties } from '../data/mockBounties';
import type { Bounty } from '../types/bounty';
const b: Bounty = { id: 't1', title: 'Test', description: 'D', tier: 'T2', skills: ['React','TS','Rust','Sol'], rewardAmount: 3500, currency: 'USDC', deadline: new Date(Date.now()+5*864e5).toISOString(), status: 'open', submissionCount: 3, createdAt: new Date().toISOString(), projectName: 'TP' };
describe('Page + Board', () => {
  it('integrates Sidebar with BountyBoard', () => {
    render(<MemoryRouter><BountiesPage /></MemoryRouter>);
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
    expect(screen.getByTestId('bounty-board')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  it('renders all cards with filters', () => {
    render(<BountyBoard />);
    expect(screen.getByText('Bounty Board')).toBeInTheDocument();
    expect(within(screen.getByTestId('bounty-grid')).getAllByTestId(/^bounty-card-/).length).toBe(mockBounties.length);
  });
  it('filters by tier and resets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<BountyBoard />);
    await u.selectOptions(screen.getByTestId('tier-filter'), 'T1');
    expect(screen.getAllByTestId(/^bounty-card-/).length).toBe(mockBounties.filter(x => x.tier==='T1').length);
    await u.click(screen.getByTestId('reset-filters'));
    expect(screen.getAllByTestId(/^bounty-card-/).length).toBe(mockBounties.length);
    vi.useRealTimers();
  });
});
describe('BountyCard', () => {
  it('renders info and handles click', async () => {
    const fn = vi.fn();
    render(<BountyCard bounty={b} onClick={fn} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('3.5k')).toBeInTheDocument();
    expect(screen.getByTestId('tier-badge-T2')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('bounty-card-t1'));
    expect(fn).toHaveBeenCalledWith('t1');
  });
  it('expired/urgent states', () => {
    const { container, rerender } = render(<BountyCard bounty={{...b, deadline: new Date(Date.now()-1000).toISOString()}} onClick={()=>{}} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('opacity-60');
    rerender(<BountyCard bounty={{...b, deadline: new Date(Date.now()+12*36e5).toISOString()}} onClick={()=>{}} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
describe('Helpers + components', () => {
  it('formatters', () => { expect(formatTimeRemaining(new Date(Date.now()-1000).toISOString())).toBe('Expired'); expect(formatReward(3500)).toBe('3.5k'); expect(formatReward(350)).toBe('350'); });
  it('TierBadge', () => { render(<TierBadge tier="T1" />); expect(screen.getByTestId('tier-badge-T1').className).toContain('text-[#14F195]'); });
  it('StatusIndicator', () => { render(<StatusIndicator status="open" />); expect(screen.getByTestId('status-open')).toHaveTextContent('Open'); });
  it('EmptyState', async () => { const fn = vi.fn(); render(<EmptyState onReset={fn} />); await userEvent.click(screen.getByTestId('empty-state-reset')); expect(fn).toHaveBeenCalledOnce(); });
});
describe('useBountyBoard', () => {
  it('filters and sorts', () => {
    const { result } = renderHook(() => useBountyBoard());
    expect(result.current.bounties.length).toBe(mockBounties.length);
    act(() => { result.current.setFilter('tier', 'T1'); });
    result.current.bounties.forEach(x => expect(x.tier).toBe('T1'));
    act(() => { result.current.resetFilters(); result.current.setSortBy('reward'); });
    const r = result.current.bounties.map(x => x.rewardAmount);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i-1]);
  });
});

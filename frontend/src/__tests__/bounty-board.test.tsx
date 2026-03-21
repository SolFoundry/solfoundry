import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BountiesPage from '../pages/BountiesPage';
import { BountyBoard } from '../components/bounties/BountyBoard';
import { BountyCard, formatTimeRemaining, formatReward } from '../components/bounties/BountyCard';
import { EmptyState } from '../components/bounties/EmptyState';
import { useBountyBoard } from '../hooks/useBountyBoard';
import { mockBounties } from '../data/mockBounties';
import type { Bounty } from '../types/bounty';
const b: Bounty = { id: 't1', title: 'Test', description: 'D', tier: 'T2', skills: ['React','TS','Rust','Sol'], rewardAmount: 3500, currency: 'USDC', deadline: new Date(Date.now()+5*864e5).toISOString(), status: 'open', submissionCount: 3, createdAt: new Date().toISOString(), projectName: 'TP', creatorType: 'community' };
describe('Page+Board', () => {
  it('renders BountyBoard with heading', () => {
    render(<MemoryRouter><BountiesPage /></MemoryRouter>);
    expect(screen.getByText('Bounty Marketplace')).toBeInTheDocument();
  });
  it('renders all cards with filters', () => {
    render(<BountyBoard />);
    expect(screen.getByText('Bounty Marketplace')).toBeInTheDocument();
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
  it('has create bounty button', () => {
    render(<BountyBoard />);
    const btn = screen.getByTestId('create-bounty-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/bounties/create');
  });
  it('has view toggle (grid/list)', () => {
    render(<BountyBoard />);
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('view-grid')).toBeInTheDocument();
    expect(screen.getByTestId('view-list')).toBeInTheDocument();
  });
  it('switches between grid and list view', async () => {
    const u = userEvent.setup();
    render(<BountyBoard />);
    expect(screen.getByTestId('bounty-grid')).toBeInTheDocument();
    await u.click(screen.getByTestId('view-list'));
    expect(screen.getByTestId('bounty-list')).toBeInTheDocument();
    expect(screen.queryByTestId('bounty-grid')).not.toBeInTheDocument();
    await u.click(screen.getByTestId('view-grid'));
    expect(screen.getByTestId('bounty-grid')).toBeInTheDocument();
  });
});
describe('BountyCard', () => {
  it('renders info and handles click', async () => {
    const fn = vi.fn();
    render(<BountyCard bounty={b} onClick={fn} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('3.5k')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /test/i }));
    expect(fn).toHaveBeenCalledWith('t1');
  });
  it('expired shows text, urgent shows indicator testid', () => {
    const { rerender } = render(<BountyCard bounty={{...b, deadline: new Date(Date.now()-1000).toISOString()}} onClick={()=>{}} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    rerender(<BountyCard bounty={{...b, deadline: new Date(Date.now()+12*36e5).toISOString()}} onClick={()=>{}} />);
    expect(screen.getByTestId('urgent-indicator')).toBeInTheDocument();
  });
  it('shows community badge for community bounty', () => {
    render(<BountyCard bounty={{...b, creatorType: 'community'}} onClick={()=>{}} />);
    expect(screen.getByTestId('creator-badge-community')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });
  it('shows platform badge for platform bounty', () => {
    render(<BountyCard bounty={{...b, creatorType: 'platform'}} onClick={()=>{}} />);
    expect(screen.getByTestId('creator-badge-platform')).toBeInTheDocument();
    expect(screen.getByText('Official')).toBeInTheDocument();
  });
  it('shows submission count for all tiers', () => {
    render(<BountyCard bounty={{...b, tier: 'T1', submissionCount: 5}} onClick={()=>{}} />);
    expect(screen.getByText('5 submissions')).toBeInTheDocument();
  });
});
describe('Helpers + components', () => {
  it('formatters', () => { expect(formatTimeRemaining(new Date(Date.now()-1000).toISOString())).toBe('Expired'); expect(formatReward(3500)).toBe('3.5k'); expect(formatReward(350)).toBe('350'); });
  it('StatusIndicator', () => { render(<BountyCard bounty={b} onClick={()=>{}} />); expect(screen.getByText('Open')).toBeInTheDocument(); });
  it('EmptyState', async () => { const fn = vi.fn(); render(<EmptyState onReset={fn} />); await userEvent.click(screen.getByRole('button', { name: /clear all filters/i })); expect(fn).toHaveBeenCalledOnce(); });
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

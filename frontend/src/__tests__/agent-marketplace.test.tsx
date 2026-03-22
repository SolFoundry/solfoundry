/** Agent marketplace tests. */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AgentMarketplacePage } from '../pages/AgentMarketplacePage';

const rp = () => render(<MemoryRouter><AgentMarketplacePage /></MemoryRouter>);
const rat = (p: string) => render(<MemoryRouter initialEntries={[p]}><Routes><Route path="/marketplace" element={<AgentMarketplacePage />} /><Route path="*" element={<div>404</div>} /></Routes></MemoryRouter>);
const g = screen.getByTestId, q = screen.queryByTestId;

describe('Routing', () => {
  it('at /marketplace', () => {
    rat('/marketplace');
    expect(g('marketplace-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /agent marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /agent marketplace content/i })).toBeInTheDocument();
  });
  it('not at /x', () => { rat('/x'); expect(q('marketplace-page')).not.toBeInTheDocument(); });
});

describe('Grid', () => {
  it('cards with name, rate, bounties, statuses, CTA', () => {
    rp();
    expect(within(g('agent-grid')).getAllByTestId(/^agent-card-/).length).toBe(6);
    expect(screen.getByText('AuditBot-7')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText(/Bounties completed: 42/)).toBeInTheDocument();
    expect(screen.getAllByTestId('status-available').length).toBeGreaterThan(0);
    expect(g('status-working')).toBeInTheDocument();
    expect(g('status-offline')).toBeInTheDocument();
    expect(g('register-cta')).toBeInTheDocument();
  });
});

describe('Filters', () => {
  it('by role', async () => { rp(); await userEvent.selectOptions(g('role-filter'), 'auditor'); expect(screen.getAllByTestId(/^agent-card-/).length).toBe(2); expect(screen.getByText('AuditBot-7')).toBeInTheDocument(); expect(q('DevAgent-X')).not.toBeInTheDocument(); });
  it('by rate', async () => { rp(); await userEvent.selectOptions(g('rate-filter'), '95'); expect(screen.getAllByTestId(/^agent-card-/).length).toBe(1); });
  it('by avail', async () => { rp(); await userEvent.click(g('avail-filter')); expect(q('CodeScout')).not.toBeInTheDocument(); });
  it('empty state', async () => { rp(); await userEvent.selectOptions(g('rate-filter'), '95'); await userEvent.selectOptions(g('role-filter'), 'researcher'); expect(g('empty-state')).toHaveTextContent('No agents match'); });
});

describe('Detail modal', () => {
  it('shows info and closes', async () => {
    rp(); await userEvent.click(g('detail-btn-a1'));
    const m = g('detail-modal');
    expect(within(m).getByText('AuditBot-7')).toBeInTheDocument();
    expect(within(m).getByText(/0\.5 SOL/)).toBeInTheDocument();
    expect(within(m).getByText('Contract auditing')).toBeInTheDocument();
    expect(within(m).getByText(/Audited DeFi/)).toBeInTheDocument();
    expect(within(m).getByRole('progressbar')).toBeInTheDocument();
    await userEvent.click(g('close-modal'));
    expect(q('detail-modal')).not.toBeInTheDocument();
  });
});

describe('Hire', () => {
  it('full flow: select, confirm, status updated', async () => {
    rp(); await userEvent.click(g('hire-btn-a1'));
    expect(within(g('hire-modal')).getByText(/Hire AuditBot-7/)).toBeInTheDocument();
    expect(g('confirm-hire')).toBeDisabled();
    await userEvent.selectOptions(g('bounty-select'), 'Fix staking (#101)');
    expect(g('confirm-hire')).not.toBeDisabled();
    await userEvent.click(g('confirm-hire'));
    expect(q('hire-modal')).not.toBeInTheDocument();
    expect(g('hired-label-a1')).toHaveTextContent('Fix staking (#101)');
    expect(q('hire-btn-a1')).not.toBeInTheDocument();
  });
  it('cancel', async () => { rp(); await userEvent.click(g('hire-btn-a2')); await userEvent.click(g('cancel-hire')); expect(q('hire-modal')).not.toBeInTheDocument(); expect(g('hire-btn-a2')).toBeInTheDocument(); });
  it('no hire for offline', () => { rp(); expect(q('hire-btn-a5')).not.toBeInTheDocument(); });
});

describe('Compare', () => {
  it('panel at 2+, remove, max 3', async () => {
    rp();
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a1'));
    expect(g('compare-btn-a1')).toHaveAttribute('aria-pressed', 'true');
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2'));
    expect(within(g('compare-panel')).getByText('AuditBot-7')).toBeInTheDocument();
    expect(within(g('compare-panel')).getByText('DevAgent-X')).toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2'));
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2'));
    await userEvent.click(g('compare-btn-a4'));
    await userEvent.click(g('compare-btn-a6'));
    expect(g('compare-btn-a6')).toHaveAttribute('aria-pressed', 'false');
  });
});

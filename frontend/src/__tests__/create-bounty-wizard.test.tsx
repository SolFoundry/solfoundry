import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateBountyPage, validateDraftShape, sanitizeHtml, buildPayload } from '../pages/CreateBountyPage';
import type { BountyDraft, BountySubmitPayload } from '../pages/CreateBountyPage';

const A = '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF';
let ws: Record<string, unknown> = {};
vi.mock('@solana/wallet-adapter-react', () => ({ useWallet: () => ws, useConnection: () => ({ connection: { rpcEndpoint: 'https://api.devnet.solana.com' } }) }));
vi.mock('@solana/wallet-adapter-wallets', () => ({}));
vi.mock('@solana/web3.js', () => ({ clusterApiUrl: (n: string) => `https://api.${n}.solana.com` }));
const C = () => { ws = { publicKey: { toBase58: () => A }, wallet: { adapter: { name: 'Phantom', icon: 'p.png' } }, connected: true, connecting: false, disconnect: vi.fn(), select: vi.fn(), wallets: [] }; };
const D = () => { ws = { publicKey: null, wallet: null, connected: false, connecting: false, disconnect: vi.fn(), select: vi.fn(), wallets: [] }; };
const R = () => render(<MemoryRouter><CreateBountyPage /></MemoryRouter>);

describe('Auth gate', () => {
  beforeEach(() => localStorage.clear());
  it('shows prompt when disconnected', () => { D(); R(); expect(screen.getByTestId('auth-gate')).toBeInTheDocument(); expect(screen.queryByTestId('step-content')).not.toBeInTheDocument(); });
  it('shows wizard when connected', () => { C(); R(); expect(screen.queryByTestId('auth-gate')).not.toBeInTheDocument(); expect(screen.getByTestId('step-content')).toBeInTheDocument(); });
});

describe('Wizard navigation', () => {
  const u = userEvent.setup();
  beforeEach(() => { localStorage.clear(); C(); });
  it('disables Next when title too short', () => { R(); expect(screen.getByTestId('btn-next')).toBeDisabled(); });
  it('advances through all steps to review', async () => {
    R(); const fd = new Date(Date.now()+7*864e5).toISOString().split('T')[0];
    await u.type(screen.getByTestId('input-title'), 'Fix token distribution bug');
    await u.click(screen.getByTestId('btn-next'));
    await u.type(screen.getByTestId('input-description'), 'We need to fix the token distribution logic that causes rounding errors.');
    await u.click(screen.getByTestId('btn-next'));
    await u.click(screen.getByText('T2')); await u.click(screen.getByTestId('btn-next'));
    await u.click(screen.getByText('React')); await u.click(screen.getByTestId('btn-next'));
    await u.type(screen.getByTestId('input-reward'), '500'); await u.click(screen.getByTestId('btn-next'));
    const di = screen.getByTestId('input-deadline');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(di, fd);
    di.dispatchEvent(new Event('change', { bubbles: true }));
    await u.click(screen.getByTestId('btn-next'));
    expect(screen.getByTestId('review-step')).toBeInTheDocument();
    expect(screen.getByTestId('review-title')).toHaveTextContent('Fix token distribution bug');
    expect(screen.getByTestId('description-preview')).toBeInTheDocument();
    expect(screen.getByTestId('btn-submit')).toBeInTheDocument();
  });
  it('Back navigates to previous step', async () => {
    R(); await u.type(screen.getByTestId('input-title'), 'Valid title here');
    await u.click(screen.getByTestId('btn-next'));
    expect(screen.getByTestId('input-description')).toBeInTheDocument();
    await u.click(screen.getByTestId('btn-prev'));
    expect(screen.getByTestId('input-title')).toBeInTheDocument();
  });
});

describe('sanitizeHtml', () => {
  it('strips scripts', () => { expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(''); });
  it('strips event handlers', () => { expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).not.toContain('onerror'); });
  it('strips javascript: URIs', () => { expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:'); });
  it('strips data: URIs', () => { expect(sanitizeHtml('<img src="data:text/html,evil">')).not.toContain('data:'); });
  it('preserves safe HTML', () => { expect(sanitizeHtml('<p>Hello</p>')).toBe('<p>Hello</p>'); });
});

describe('buildPayload', () => {
  it('correct shape, no created_by, numeric reward', () => {
    const d: BountyDraft = { title: '  Fix bug  ', description: '  Desc here  ', tier: 'T2', skills: ['React'], rewardAmount: '500', currency: 'USDC', deadline: '2026-04-01' };
    const p = buildPayload(d);
    expect(p).toEqual({ title: 'Fix bug', description: 'Desc here', tier: 'T2', skills: ['React'], rewardAmount: 500, currency: 'USDC', deadline: '2026-04-01' } satisfies BountySubmitPayload);
    expect(p).not.toHaveProperty('created_by'); expect(p).not.toHaveProperty('createdBy');
    expect(typeof p.rewardAmount).toBe('number');
  });
  it('trims whitespace', () => { const p = buildPayload({ title: ' a ', description: ' b ', tier: 'T1', skills: [], rewardAmount: '1', currency: 'SOL', deadline: '' }); expect(p.title).toBe('a'); });
  it('copies skills array', () => { const sk = ['React']; expect(buildPayload({ title: 'x', description: 'y', tier: 'T1', skills: sk, rewardAmount: '1', currency: 'USDC', deadline: '' }).skills).not.toBe(sk); });
});

describe('validateDraftShape', () => {
  const g: BountyDraft = { title: 'T', description: 'D', tier: 'T1', skills: ['React'], rewardAmount: '100', currency: 'USDC', deadline: '2026-04-01' };
  it('accepts valid', () => { expect(validateDraftShape(g)).toEqual(g); });
  it('rejects null/undefined', () => { expect(validateDraftShape(null)).toBeNull(); expect(validateDraftShape(undefined)).toBeNull(); });
  it('rejects bad tier', () => { expect(validateDraftShape({ ...g, tier: 'T99' })).toBeNull(); });
  it('rejects bad currency', () => { expect(validateDraftShape({ ...g, currency: 'BTC' })).toBeNull(); });
  it('rejects wrong types', () => { expect(validateDraftShape({ ...g, title: 123 })).toBeNull(); expect(validateDraftShape({ ...g, skills: 'x' })).toBeNull(); expect(validateDraftShape({ ...g, skills: [1] })).toBeNull(); });
});

describe('Draft localStorage', () => {
  beforeEach(() => localStorage.clear());
  it('scopes to wallet address', () => { C(); R(); expect(localStorage.getItem(`solfoundry_bounty_draft_${A}`)).not.toBeNull(); });
  it('recovers from corrupt data', () => { localStorage.setItem(`solfoundry_bounty_draft_${A}`, '{"title":123}'); C(); R(); expect(JSON.parse(localStorage.getItem(`solfoundry_bounty_draft_${A}`)!).title).toBe(''); });
});

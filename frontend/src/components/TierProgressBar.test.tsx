/**
 * Unit tests for TierProgressBar — covers all acceptance criteria from issue #342:
 *   - new user (0/0/0)
 *   - T2 eligible (4 T1s)
 *   - T3 eligible via path A (3+ T2s)
 *   - T3 eligible via path B (5 T1s + 1 T2)
 *   - maxed out (T3 achieved)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { TierProgressBar, computeTierState } from './TierProgressBar';
import type { TierStats } from '../types/badges';

// ─── computeTierState unit tests ──────────────────────────────────────────────

describe('computeTierState', () => {
  it('new user (0/0/0): currentTier=1, t2Eligible=false, t3Unlocked=false', () => {
    const state = computeTierState({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    expect(state.currentTier).toBe(1);
    expect(state.t2Eligible).toBe(false);
    expect(state.t3Unlocked).toBe(false);
    expect(state.t1Progress.count).toBe(0);
    expect(state.t1Progress.required).toBe(4);
  });

  it('T2 eligible (4 T1s, 0 T2s): currentTier=2, t2Eligible=true, t3Unlocked=false', () => {
    const state = computeTierState({ t1Merged: 4, t2Merged: 0, t3Merged: 0 });
    expect(state.currentTier).toBe(2);
    expect(state.t2Eligible).toBe(true);
    expect(state.t3Unlocked).toBe(false);
    expect(state.t3Path).toBeNull();
  });

  it('T3 eligible via path-a (3 T2s): currentTier=3, t3Unlocked=true, t3Path=path-a', () => {
    const state = computeTierState({ t1Merged: 4, t2Merged: 3, t3Merged: 0 });
    expect(state.currentTier).toBe(3);
    expect(state.t3Unlocked).toBe(true);
    expect(state.t3Path).toBe('path-a');
  });

  it('T3 eligible via path-b (5 T1s + 1 T2): currentTier=3, t3Unlocked=true, t3Path=path-b', () => {
    const state = computeTierState({ t1Merged: 5, t2Merged: 1, t3Merged: 0 });
    expect(state.currentTier).toBe(3);
    expect(state.t3Unlocked).toBe(true);
    expect(state.t3Path).toBe('path-b');
  });

  it('maxed out (5 T1s, 3 T2s, 1 T3): currentTier=3, all flags true', () => {
    const state = computeTierState({ t1Merged: 5, t2Merged: 3, t3Merged: 1 });
    expect(state.currentTier).toBe(3);
    expect(state.t2Eligible).toBe(true);
    expect(state.t3Unlocked).toBe(true);
  });

  it('path-a takes precedence when both paths satisfied', () => {
    const state = computeTierState({ t1Merged: 5, t2Merged: 3, t3Merged: 0 });
    expect(state.t3Path).toBe('path-a');
  });

  it('3 T2s without 4 T1s still unlocks T3 via path-a', () => {
    const state = computeTierState({ t1Merged: 2, t2Merged: 3, t3Merged: 0 });
    expect(state.t3Unlocked).toBe(true);
    expect(state.t3Path).toBe('path-a');
  });
});

// ─── TierProgressBar render tests ────────────────────────────────────────────

function renderBar(stats: TierStats) {
  return render(<TierProgressBar tierStats={stats} />);
}

describe('TierProgressBar rendering', () => {
  it('renders with data-testid="tier-progress-bar"', () => {
    renderBar({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByTestId('tier-progress-bar')).toBeInTheDocument();
  });

  it('renders all 3 milestone nodes', () => {
    renderBar({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByTestId('tier-milestone-1')).toBeInTheDocument();
    expect(screen.getByTestId('tier-milestone-2')).toBeInTheDocument();
    expect(screen.getByTestId('tier-milestone-3')).toBeInTheDocument();
  });

  it('new user: shows "Tier 1" badge and 0/4 progress label', () => {
    renderBar({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
    // "0/4" appears in both the milestone label and the sub-text footer
    expect(screen.getAllByText(/0\/4/).length).toBeGreaterThanOrEqual(1);
  });

  it('T2 eligible: shows "Tier 2" badge', () => {
    renderBar({ t1Merged: 4, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByText('Tier 2')).toBeInTheDocument();
  });

  it('T3 unlocked via path-a: shows "Tier 3" badge', () => {
    renderBar({ t1Merged: 4, t2Merged: 3, t3Merged: 0 });
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('T3 unlocked via path-b: shows "Tier 3" badge', () => {
    renderBar({ t1Merged: 5, t2Merged: 1, t3Merged: 0 });
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('maxed out: shows all-tiers-unlocked message', () => {
    renderBar({ t1Merged: 5, t2Merged: 3, t3Merged: 1 });
    expect(screen.getByText(/All tiers unlocked/i)).toBeInTheDocument();
  });

  it('T3 not unlocked: shows next-unlock requirements text', () => {
    renderBar({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByText(/Next: T2/i)).toBeInTheDocument();
  });

  it('T2 unlocked but not T3: shows T3 requirement text', () => {
    renderBar({ t1Merged: 4, t2Merged: 0, t3Merged: 0 });
    expect(screen.getByText(/Next: T3/i)).toBeInTheDocument();
  });
});

describe('TierProgressBar tooltips', () => {
  it('T1 milestone tooltip shows on focus', () => {
    renderBar({ t1Merged: 2, t2Merged: 0, t3Merged: 0 });
    const node = screen.getByTestId('tier-milestone-1');
    fireEvent.focus(node);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('T1 tooltip hides on blur', () => {
    renderBar({ t1Merged: 2, t2Merged: 0, t3Merged: 0 });
    const node = screen.getByTestId('tier-milestone-1');
    fireEvent.focus(node);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(node);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('T3 milestone node has accessible aria-label', () => {
    renderBar({ t1Merged: 0, t2Merged: 0, t3Merged: 0 });
    const node = screen.getByTestId('tier-milestone-3');
    expect(node).toHaveAttribute('aria-label', expect.stringContaining('Tier 3'));
  });
});

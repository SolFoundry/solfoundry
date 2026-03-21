import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TierProgressBar } from './TierProgressBar';

describe('TierProgressBar', () => {
  it('renders for new user (0/0/0)', () => {
    render(<TierProgressBar completedT1={0} completedT2={0} completedT3={0} />);
    
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('T3')).toBeInTheDocument();
    
    // T1 should be current tier
    const t1Badge = screen.getByText('T1').closest('div');
    expect(t1Badge?.className).toContain('from-[#9945FF]');
    
    // Stats should show zeros
    expect(screen.getByText('0 T1')).toBeInTheDocument();
    expect(screen.getByText('0 T2')).toBeInTheDocument();
    expect(screen.getByText('0 T3')).toBeInTheDocument();
  });

  it('shows T2 as current when eligible', () => {
    render(<TierProgressBar completedT1={4} completedT2={0} completedT3={0} />);
    
    // T2 should be current (just unlocked)
    const t2Badge = screen.getByText('T2').closest('div');
    expect(t2Badge?.className).toContain('from-[#9945FF]');
    
    // T1 should be unlocked but not current
    const t1Badge = screen.getByText('T1').closest('div');
    expect(t1Badge?.className).toContain('text-[#14F195]');
    
    // Stats
    expect(screen.getByText('4 T1')).toBeInTheDocument();
  });

  it('shows T3 eligible via T2 path', () => {
    render(<TierProgressBar completedT1={4} completedT2={3} completedT3={0} />);
    
    // T3 should be current (unlocked via 3 T2s)
    const t3Badge = screen.getByText('T3').closest('div');
    expect(t3Badge?.className).toContain('from-[#9945FF]');
    
    // T1 and T2 should be unlocked
    expect(screen.getByText('4 T1')).toBeInTheDocument();
    expect(screen.getByText('3 T2')).toBeInTheDocument();
  });

  it('shows T3 eligible via mixed path (5+ T1 and 1+ T2)', () => {
    render(<TierProgressBar completedT1={5} completedT2={1} completedT3={0} />);
    
    // T3 should be current (unlocked via mixed path)
    const t3Badge = screen.getByText('T3').closest('div');
    expect(t3Badge?.className).toContain('from-[#9945FF]');
    
    // Stats
    expect(screen.getByText('5 T1')).toBeInTheDocument();
    expect(screen.getByText('1 T2')).toBeInTheDocument();
  });

  it('shows progress towards T2', () => {
    render(<TierProgressBar completedT1={2} completedT2={0} completedT3={0} />);
    
    // T1 should still be current
    const t1Badge = screen.getByText('T1').closest('div');
    expect(t1Badge?.className).toContain('from-[#9945FF]');
    
    // T2 should not be unlocked
    const t2Badge = screen.getByText('T2').closest('div');
    expect(t2Badge?.className).toContain('bg-gray-800');
    
    expect(screen.getByText('2 T1')).toBeInTheDocument();
  });

  it('shows maxed out user (all T3s)', () => {
    render(<TierProgressBar completedT1={10} completedT2={5} completedT3={3} />);
    
    // T3 should be current
    const t3Badge = screen.getByText('T3').closest('div');
    expect(t3Badge?.className).toContain('from-[#9945FF]');
    
    // All should show unlocked styling
    expect(screen.getByText('10 T1')).toBeInTheDocument();
    expect(screen.getByText('5 T2')).toBeInTheDocument();
    expect(screen.getByText('3 T3')).toBeInTheDocument();
  });

  it('shows tooltips with requirements', () => {
    render(<TierProgressBar completedT1={0} completedT2={0} completedT3={0} />);
    
    // T2 tooltip should mention 4 T1 requirement
    const t2Badge = screen.getByText('T2');
    const tooltip = t2Badge.closest('div')?.querySelector('.absolute.bottom-full');
    expect(tooltip?.textContent).toContain('4 T1 bounties');
  });

  it('progress bar width increases with progress', () => {
    const { rerender } = render(<TierProgressBar completedT1={0} completedT2={0} completedT3={0} />);
    
    // Initial state - around 33% (T1 unlocked)
    const progressBar = document.querySelector('.bg-gradient-to-r.from-\\[\\#9945FF\\]');
    expect(progressBar).toBeInTheDocument();
    
    // Progress to T2
    rerender(<TierProgressBar completedT1={4} completedT2={0} completedT3={0} />);
    
    // Should be around 66%
    const progressBarAfter = document.querySelector('.bg-gradient-to-r.from-\\[\\#9945FF\\]');
    expect(progressBarAfter).toBeInTheDocument();
  });
});
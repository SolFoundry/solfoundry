import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children without tooltip initially', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter after delay', () => {
    render(
      <Tooltip content="Total earned in $FNDRY tokens" delayMs={200}>
        <span>Total Earned</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Total Earned').closest('div')!);

    // Not visible before delay
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Total earned in $FNDRY tokens')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <Tooltip content="Help text" delayMs={0}>
        <span>Target</span>
      </Tooltip>,
    );

    const trigger = screen.getByText('Target').closest('div')!;
    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(10); });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus (keyboard accessibility)', () => {
    render(
      <Tooltip content="Keyboard accessible" delayMs={0}>
        <button>Focus me</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByText('Focus me').closest('div')!);
    act(() => { vi.advanceTimersByTime(10); });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on blur', () => {
    render(
      <Tooltip content="Blur test" delayMs={0}>
        <button>Blur me</button>
      </Tooltip>,
    );

    const trigger = screen.getByText('Blur me').closest('div')!;
    fireEvent.focus(trigger);
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('supports all position variants', () => {
    const positions = ['top', 'bottom', 'left', 'right'] as const;

    for (const pos of positions) {
      const { unmount } = render(
        <Tooltip content={`Position: ${pos}`} position={pos} delayMs={0}>
          <span>Target</span>
        </Tooltip>,
      );

      const trigger = screen.getByText('Target').closest('div')!;
      fireEvent.mouseEnter(trigger);
      act(() => { vi.advanceTimersByTime(10); });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(`Position: ${pos}`)).toBeInTheDocument();

      unmount();
    }
  });

  it('has correct ARIA role for accessibility', () => {
    render(
      <Tooltip content="Accessible" delayMs={0}>
        <span>Trigger</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').closest('div')!);
    act(() => { vi.advanceTimersByTime(10); });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('applies dark mode styling classes', () => {
    render(
      <Tooltip content="Dark mode" delayMs={0}>
        <span>Theme</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Theme').closest('div')!);
    act(() => { vi.advanceTimersByTime(10); });

    const tooltipContent = screen.getByText('Dark mode');
    // Should have dark-mode classes
    expect(tooltipContent.className).toContain('dark:');
  });

  it('clears timeout when unmounted during delay', () => {
    const { unmount } = render(
      <Tooltip content="Unmount test" delayMs={500}>
        <span>Short-lived</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Short-lived').closest('div')!);

    // Unmount before delay fires — should not throw
    unmount();
    act(() => { vi.advanceTimersByTime(600); });
  });

  it('renders with custom delay', () => {
    render(
      <Tooltip content="Custom delay" delayMs={500}>
        <span>Slow</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Slow').closest('div')!);

    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});

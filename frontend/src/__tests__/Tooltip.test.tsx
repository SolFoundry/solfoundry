import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../components/ui/Tooltip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTooltip(
  content = 'Tooltip text',
  position: 'top' | 'bottom' | 'left' | 'right' = 'top'
) {
  return render(
    <Tooltip content={content} position={position}>
      <button type="button">Trigger</button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    renderTooltip();
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
  });

  it('tooltip bubble is hidden by default (opacity-0)', () => {
    renderTooltip('Hello tooltip');
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(bubble).toHaveClass('opacity-0');
    expect(bubble).not.toHaveClass('opacity-100');
  });

  it('shows tooltip on mouse enter', async () => {
    renderTooltip('Hover content');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(trigger);
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveClass('opacity-100');
    expect(bubble).toHaveTextContent('Hover content');
  });

  it('hides tooltip on mouse leave (after brief delay)', async () => {
    renderTooltip('Hover content');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');

    fireEvent.mouseLeave(trigger);
    // Before the 80ms timer fires the bubble is still rendered
    expect(screen.getByRole('tooltip', { hidden: true })).toBeInTheDocument();

    // Advance timer past hide delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() =>
      expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('opacity-0')
    );
  });

  it('shows tooltip on focus', () => {
    renderTooltip('Focus content');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');
  });

  it('hides tooltip on blur', async () => {
    renderTooltip('Focus content');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;

    fireEvent.focus(trigger);
    fireEvent.blur(trigger);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() =>
      expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('opacity-0')
    );
  });

  it('toggles on click (tap to show)', async () => {
    renderTooltip('Tap content');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;

    // First tap: show
    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');

    // Second tap: hide
    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('opacity-0');
  });

  it('closes on outside click when visible', async () => {
    renderTooltip('Outside click');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');

    // Simulate outside click by firing on document
    fireEvent.click(document);

    await waitFor(() =>
      expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('opacity-0')
    );
  });

  it('renders content string correctly', () => {
    renderTooltip('My tooltip text');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('My tooltip text');
  });

  it('defaults to top position when position is omitted', () => {
    render(
      <Tooltip content="Default position">
        <span>child</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('child').parentElement!;
    const bubble = wrapper.querySelector('[role="tooltip"]');
    // top position adds bottom-full class
    expect(bubble).toHaveClass('bottom-full');
  });

  it('applies bottom position classes', () => {
    render(
      <Tooltip content="Bottom tip" position="bottom">
        <span>child</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('child').parentElement!;
    const bubble = wrapper.querySelector('[role="tooltip"]');
    expect(bubble).toHaveClass('top-full');
  });

  it('applies left position classes', () => {
    render(
      <Tooltip content="Left tip" position="left">
        <span>child</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('child').parentElement!;
    const bubble = wrapper.querySelector('[role="tooltip"]');
    expect(bubble).toHaveClass('right-full');
  });

  it('applies right position classes', () => {
    render(
      <Tooltip content="Right tip" position="right">
        <span>child</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('child').parentElement!;
    const bubble = wrapper.querySelector('[role="tooltip"]');
    expect(bubble).toHaveClass('left-full');
  });

  it('applies optional className to wrapper', () => {
    render(
      <Tooltip content="cls" className="my-custom-class">
        <span>child</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('child').parentElement!;
    expect(wrapper).toHaveClass('my-custom-class');
  });

  it('has aria-hidden=true when not visible', () => {
    renderTooltip();
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(bubble).toHaveAttribute('aria-hidden', 'true');
  });

  it('has aria-hidden=false when visible', () => {
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(trigger);
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveAttribute('aria-hidden', 'false');
  });

  it('does not flicker when mouse re-enters before hide delay', async () => {
    renderTooltip('No flicker');
    const trigger = screen.getByRole('button', { name: 'Trigger' }).parentElement!;

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    // Re-enter before the 80ms delay fires
    fireEvent.mouseEnter(trigger);

    // Advance past the original hide delay — tooltip should still be visible
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');
  });

  it('renders children other than buttons', () => {
    render(
      <Tooltip content="div child">
        <div data-testid="inner-div">content</div>
      </Tooltip>
    );
    expect(screen.getByTestId('inner-div')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Integration: Tooltip applied to dashboard-style stat card
// ---------------------------------------------------------------------------

describe('Tooltip on stat card', () => {
  it('wraps a stat card label and shows tooltip on hover', () => {
    render(
      <div>
        <Tooltip content="Total number of bounties posted across all tiers" position="top">
          <span data-testid="stat-label">Total Bounties</span>
        </Tooltip>
        <p data-testid="stat-value">42</p>
      </div>
    );

    const label = screen.getByTestId('stat-label');
    expect(label).toHaveTextContent('Total Bounties');

    // Hover the wrapper
    fireEvent.mouseEnter(label.parentElement!);
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveTextContent('Total number of bounties posted across all tiers');
    expect(bubble).toHaveClass('opacity-100');
  });
});

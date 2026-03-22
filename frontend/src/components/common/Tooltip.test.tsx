/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children correctly', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeTruthy();
  });

  it('renders tooltip content in the DOM', () => {
    render(
      <Tooltip content="This is a tooltip">
        <span>Label</span>
      </Tooltip>
    );
    // Tooltip text should exist in DOM (but invisible initially)
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('This is a tooltip')).toBeTruthy();
  });

  it('shows tooltip on mouse enter after delay', () => {
    render(
      <Tooltip content="Helpful info" delay={100}>
        <span>Trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger').closest('[role="button"]')!;
    const tooltip = screen.getByRole('tooltip');

    // Initially invisible
    expect(tooltip.className).toContain('invisible');

    // Hover
    fireEvent.mouseEnter(trigger);

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Now visible
    expect(tooltip.className).toContain('opacity-100');
    expect(tooltip.className).not.toContain('invisible');
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <Tooltip content="Info text" delay={0}>
        <span>Trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger').closest('[role="button"]')!;
    const tooltip = screen.getByRole('tooltip');

    // Show
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(tooltip.className).toContain('opacity-100');

    // Hide
    fireEvent.mouseLeave(trigger);
    expect(tooltip.className).toContain('invisible');
  });

  it('toggles tooltip on touch (mobile)', () => {
    render(
      <Tooltip content="Touch info" delay={0}>
        <span>Tap me</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Tap me').closest('[role="button"]')!;
    const tooltip = screen.getByRole('tooltip');

    // Initially hidden
    expect(tooltip.className).toContain('invisible');

    // First tap shows
    fireEvent.touchStart(trigger);
    expect(tooltip.className).toContain('opacity-100');

    // Second tap hides
    fireEvent.touchStart(trigger);
    expect(tooltip.className).toContain('invisible');
  });

  it('shows tooltip on focus (keyboard accessibility)', () => {
    render(
      <Tooltip content="Focus info" delay={0}>
        <span>Focusable</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Focusable').closest('[role="button"]')!;
    const tooltip = screen.getByRole('tooltip');

    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(tooltip.className).toContain('opacity-100');
  });

  it('hides tooltip on blur', () => {
    render(
      <Tooltip content="Blur info" delay={0}>
        <span>Blurable</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Blurable').closest('[role="button"]')!;
    const tooltip = screen.getByRole('tooltip');

    // Show
    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(tooltip.className).toContain('opacity-100');

    // Hide
    fireEvent.blur(trigger);
    expect(tooltip.className).toContain('invisible');
  });

  it('applies custom className', () => {
    render(
      <Tooltip content="Styled" className="custom-class">
        <span>Styled trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Styled trigger').closest('[role="button"]')!;
    expect(trigger.className).toContain('custom-class');
  });

  it('renders with different positions', () => {
    const positions = ['top', 'bottom', 'left', 'right'] as const;

    positions.forEach((position) => {
      const { unmount } = render(
        <Tooltip content={`${position} tooltip`} position={position}>
          <span>{position}</span>
        </Tooltip>
      );

      expect(screen.getByText(`${position} tooltip`)).toBeTruthy();
      unmount();
    });
  });

  it('has proper aria attributes', () => {
    render(
      <Tooltip content="Accessible tooltip" delay={0}>
        <span>Trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger').closest('[role="button"]')!;

    // Trigger has tabIndex for keyboard navigation
    expect(trigger.getAttribute('tabindex')).toBe('0');

    // Tooltip has role="tooltip"
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('sets aria-describedby when visible', () => {
    render(
      <Tooltip content="Described tooltip" delay={0}>
        <span>Trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger').closest('[role="button"]')!;

    // Not described when hidden
    expect(trigger.getAttribute('aria-describedby')).toBeNull();

    // Show tooltip
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    // Now described
    expect(trigger.getAttribute('aria-describedby')).toBe('tooltip');
  });
});

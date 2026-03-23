/**
 * Tests for the reusable Tooltip component (bounty #484).
 *
 * Covers:
 * - Renders children without showing tooltip by default
 * - Shows tooltip content on hover (mouseenter)
 * - Hides tooltip on mouse leave
 * - Supports all four positions (top, bottom, left, right)
 * - Includes accessible role="tooltip"
 * - Shows/hides on touch for mobile
 * - Smooth animation class is applied
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tooltip } from '../components/common/Tooltip';

describe('Tooltip', () => {
  it('renders children without tooltip visible', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouseenter and hides on mouseleave', () => {
    render(
      <Tooltip content="Explanation text">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText('Trigger').closest('div')!;

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Explanation text')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('toggles tooltip on touch (mobile)', () => {
    render(
      <Tooltip content="Tap tooltip">
        <button>Tap me</button>
      </Tooltip>
    );
    const trigger = screen.getByText('Tap me').closest('div')!;

    fireEvent.touchStart(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.touchStart(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies the fade-in animation class', () => {
    render(
      <Tooltip content="Animated">
        <span>Target</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Target').closest('div')!;
    fireEvent.mouseEnter(trigger);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain('animate-tooltip-fade-in');
  });

  it('renders with position="bottom"', () => {
    render(
      <Tooltip content="Bottom tip" position="bottom">
        <span>Bottom</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Bottom').closest('div')!;
    fireEvent.mouseEnter(trigger);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain('top-full');
  });

  it('renders with position="left"', () => {
    render(
      <Tooltip content="Left tip" position="left">
        <span>Left</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Left').closest('div')!;
    fireEvent.mouseEnter(trigger);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain('right-full');
  });

  it('renders with position="right"', () => {
    render(
      <Tooltip content="Right tip" position="right">
        <span>Right</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Right').closest('div')!;
    fireEvent.mouseEnter(trigger);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain('left-full');
  });

  it('supports delay before showing', async () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Delayed" delay={200}>
        <span>Wait</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Wait').closest('div')!;
    fireEvent.mouseEnter(trigger);

    // Should not be visible immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Advance past the delay
    act(() => { jest.advanceTimersByTime(250); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('applies dark theme classes', () => {
    render(
      <Tooltip content="Dark mode ready">
        <span>Theme</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Theme').closest('div')!;
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    // Should have dark-mode specific classes
    expect(tooltip.className).toContain('dark:bg-gray-700');
    expect(tooltip.className).toContain('dark:text-gray-100');
  });

  it('has an arrow element', () => {
    render(
      <Tooltip content="With arrow">
        <span>Arrow</span>
      </Tooltip>
    );
    const trigger = screen.getByText('Arrow').closest('div')!;
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    const arrow = tooltip.querySelector('[aria-hidden="true"]');
    expect(arrow).toBeInTheDocument();
  });
});

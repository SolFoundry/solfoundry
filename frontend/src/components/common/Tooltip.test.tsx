/**
 * @jest-environment jsdom
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tooltip } from './Tooltip';

// Mock requestAnimationFrame so position logic runs synchronously in tests
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  // Provide a stable getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100,
    left: 100,
    bottom: 120,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content="hello"><span>trigger</span></Tooltip>);
    expect(screen.getByText('trigger')).toBeTruthy();
  });

  it('tooltip content is initially hidden (aria-hidden)', () => {
    render(<Tooltip content="tip text"><span>hover me</span></Tooltip>);
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows tooltip on mouseenter and hides on mouseleave', async () => {
    render(<Tooltip content="tooltip msg"><span>trigger</span></Tooltip>);
    const wrapper = screen.getByText('trigger').closest('span')!.parentElement!;
    act(() => { fireEvent.mouseEnter(wrapper); });
    expect(screen.getByRole('tooltip').getAttribute('aria-hidden')).toBe('false');
    act(() => { fireEvent.mouseLeave(wrapper); });
    expect(screen.getByRole('tooltip', { hidden: true }).getAttribute('aria-hidden')).toBe('true');
  });

  it('shows tooltip on focus and hides on blur (keyboard support)', () => {
    render(<Tooltip content="focus tip"><span>focusable</span></Tooltip>);
    const wrapper = screen.getByText('focusable').closest('span')!.parentElement!;
    act(() => { fireEvent.focus(wrapper); });
    expect(screen.getByRole('tooltip').getAttribute('aria-hidden')).toBe('false');
    act(() => { fireEvent.blur(wrapper); });
    expect(screen.getByRole('tooltip', { hidden: true }).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders complex ReactNode as tooltip content', () => {
    render(
      <Tooltip content={<span data-testid="rich-tip">Rich <strong>content</strong></span>}>
        <button>btn</button>
      </Tooltip>,
    );
    expect(screen.getByTestId('rich-tip')).toBeTruthy();
  });

  it('applies custom className to wrapper', () => {
    render(<Tooltip content="tip" className="my-class"><span>x</span></Tooltip>);
    const wrapper = screen.getByText('x').parentElement!;
    expect(wrapper.className).toContain('my-class');
  });

  it('uses role=tooltip for accessibility', () => {
    render(<Tooltip content="accessible tip"><span>t</span></Tooltip>);
    expect(screen.getByRole('tooltip', { hidden: true })).toBeTruthy();
  });
});

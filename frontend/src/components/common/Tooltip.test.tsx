/**
 * Tooltip.test.tsx — Comprehensive tests for the reusable Tooltip component.
 *
 * Covers:
 *  1.  Renders trigger + no tooltip by default
 *  2.  Shows tooltip on mouseenter (desktop hover)
 *  3.  Hides tooltip on mouseleave (desktop hover)
 *  4.  Shows tooltip on focus (keyboard navigation)
 *  5.  Hides tooltip on blur (keyboard navigation)
 *  6.  Hides tooltip on Escape key
 *  7.  Mobile tap — shows tooltip on click with touch pointer
 *  8.  Mobile tap — hides on click outside
 *  9.  Viewport flip — flips 'top' → 'bottom' when near top edge
 * 10.  Renders with 'bottom', 'left', 'right' positions
 * 11.  Applies dark-theme classes
 * 12.  Tooltip has role="tooltip" and aria-describedby linkage
 * 13.  Content string is rendered inside the bubble
 * 14.  Portal renders tooltip into document.body (not inside wrapper)
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Tooltip } from './Tooltip';

// ============================================================================
// Helpers
// ============================================================================

/** Simulate a pointer-enter event with a given pointerType. */
function pointerEnter(el: Element, pointerType: 'mouse' | 'touch' = 'mouse') {
  fireEvent.pointerEnter(el, { pointerType });
}

function pointerLeave(el: Element, pointerType: 'mouse' | 'touch' = 'mouse') {
  fireEvent.pointerLeave(el, { pointerType });
}

/** Render a Tooltip with a simple trigger span. */
function renderTooltip(
  content = 'Helpful text',
  position: 'top' | 'bottom' | 'left' | 'right' = 'top',
  triggerText = 'Hover me',
) {
  return render(
    <Tooltip content={content} position={position}>
      <span>{triggerText}</span>
    </Tooltip>,
  );
}

// ============================================================================
// Mock window dimensions for viewport overflow tests
// ============================================================================

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function mockTriggerRect(rect: Partial<DOMRect>) {
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100,
    bottom: 120,
    left: 100,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 100,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

// ============================================================================
// Tests
// ============================================================================

describe('Tooltip', () => {
  beforeEach(() => {
    // Reset viewport to a reasonable default
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  // ── 1. Default render ─────────────────────────────────────────────────────

  it('renders the trigger element without showing the tooltip initially', () => {
    renderTooltip('My tooltip content');

    // Trigger text is visible
    expect(screen.getByText('Hover me')).toBeInTheDocument();

    // Tooltip content should be in the DOM (portal) but not visually visible
    // (opacity-0 / aria-hidden). We verify it is either absent or aria-hidden.
    const tooltip = screen.queryByRole('tooltip');
    if (tooltip) {
      expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    }
  });

  // ── 2. Desktop hover — show ───────────────────────────────────────────────

  it('shows the tooltip on mouseenter (desktop)', async () => {
    renderTooltip('Total $FNDRY tokens earned');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    pointerEnter(wrapper, 'mouse');

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false');
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent('Total $FNDRY tokens earned');
  });

  // ── 3. Desktop hover — hide ───────────────────────────────────────────────

  it('hides the tooltip on mouseleave (desktop)', async () => {
    renderTooltip('Tooltip text');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    // Show first
    pointerEnter(wrapper, 'mouse');
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    // Then hide
    pointerLeave(wrapper, 'mouse');
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'true'),
    );
  });

  // ── 4. Keyboard — focus shows tooltip ────────────────────────────────────

  it('shows the tooltip when the wrapper gains focus', async () => {
    renderTooltip('Focus tooltip');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    fireEvent.focus(wrapper);

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );
  });

  // ── 5. Keyboard — blur hides tooltip ─────────────────────────────────────

  it('hides the tooltip when the wrapper loses focus', async () => {
    renderTooltip('Focus tooltip');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    fireEvent.focus(wrapper);
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    fireEvent.blur(wrapper);
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'true'),
    );
  });

  // ── 6. Escape key hides tooltip ───────────────────────────────────────────

  it('hides the tooltip when Escape is pressed', async () => {
    renderTooltip('Escape test');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    fireEvent.focus(wrapper);
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    fireEvent.keyDown(wrapper, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'true'),
    );
  });

  // ── 7. Mobile tap — click with touch pointer shows tooltip ────────────────

  it('shows the tooltip on tap (touch click) on mobile', async () => {
    renderTooltip('Mobile tooltip');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    // Simulate touch pointer enter (sets isMobileRef) then click
    pointerEnter(wrapper, 'touch');
    fireEvent.click(wrapper);

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );
  });

  // ── 8. Mobile tap — click outside hides tooltip ───────────────────────────

  it('hides the tooltip when clicking outside on mobile', async () => {
    renderTooltip('Mobile tooltip');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    // Show via tap
    pointerEnter(wrapper, 'touch');
    fireEvent.click(wrapper);
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'true'),
    );
  });

  // ── 9. Viewport flip: top → bottom when trigger is near top ──────────────

  it('flips position from top to bottom when trigger is near the top viewport edge', async () => {
    // Place trigger very close to the top (only 5px from edge)
    mockTriggerRect({ top: 5, bottom: 25, left: 200, right: 300 });

    renderTooltip('Flip test', 'top');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    pointerEnter(wrapper, 'mouse');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    // The resolved position should be 'bottom' after the flip
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-position', 'bottom');
  });

  // ── 10. Position variants render without errors ────────────────────────────

  it.each(['bottom', 'left', 'right'] as const)(
    'renders with position="%s" without crashing',
    async (pos) => {
      const { unmount } = render(
        <Tooltip content={`Position ${pos}`} position={pos}>
          <span>Trigger</span>
        </Tooltip>,
      );
      const wrapper = screen.getByText('Trigger').closest('span[tabindex]')!;
      pointerEnter(wrapper, 'mouse');

      await waitFor(() =>
        expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
      );

      expect(screen.getByRole('tooltip')).toHaveTextContent(`Position ${pos}`);
      unmount();
    },
  );

  // ── 11. Dark-theme classes ────────────────────────────────────────────────

  it('includes dark-theme Tailwind classes on the tooltip bubble', async () => {
    renderTooltip('Dark theme check');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    pointerEnter(wrapper, 'mouse');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    const tooltip = screen.getByRole('tooltip');
    // Check that the dark-mode class is present in the class list
    expect(tooltip.className).toMatch(/dark:bg-gray-700/);
    expect(tooltip.className).toMatch(/dark:text-gray-100/);
  });

  // ── 12. ARIA linkage ──────────────────────────────────────────────────────

  it('links trigger to tooltip via aria-describedby when visible', async () => {
    renderTooltip('ARIA description');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    // Before hover — no aria-describedby
    expect(wrapper).not.toHaveAttribute('aria-describedby');

    pointerEnter(wrapper, 'mouse');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    // After hover — aria-describedby should reference the tooltip id
    expect(wrapper).toHaveAttribute('aria-describedby');
    const describedById = wrapper.getAttribute('aria-describedby')!;
    const tooltip = document.getElementById(describedById);
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveTextContent('ARIA description');
  });

  // ── 13. Content rendering ─────────────────────────────────────────────────

  it('renders the correct content string in the tooltip', async () => {
    const content = 'Your ranking among all contributors based on completed work';
    renderTooltip(content);
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    pointerEnter(wrapper, 'mouse');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent(content);
  });

  // ── 14. Portal — renders in body, not inside the trigger wrapper ──────────

  it('renders the tooltip inside document.body via a portal', async () => {
    const { container } = renderTooltip('Portal check');
    const wrapper = screen.getByText('Hover me').closest('span[tabindex]')!;

    pointerEnter(wrapper, 'mouse');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveAttribute('aria-hidden', 'false'),
    );

    const tooltip = screen.getByRole('tooltip');

    // The tooltip must NOT be a descendant of the render container
    expect(container).not.toContainElement(tooltip);

    // It must be a descendant of document.body (portal target)
    expect(document.body).toContainElement(tooltip);
  });
});

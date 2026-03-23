/**
 * Tooltip — Reusable accessible tooltip component with smart viewport positioning.
 *
 * Features:
 * - Portal-based rendering to avoid z-index stacking issues
 * - Smart viewport overflow detection with automatic position flipping
 * - Desktop: show on mouseenter / hide on mouseleave
 * - Mobile: show on click/tap / hide on click outside
 * - Smooth fade-in + translate animation via CSS transitions
 * - Matches dark/light theme via Tailwind `dark:` variants
 * - Full keyboard accessibility (focus/blur)
 *
 * @module components/common/Tooltip
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The tooltip text content shown on hover/tap. */
  content: string;
  /** The trigger element. */
  children: React.ReactNode;
  /** Preferred position. Will flip automatically if it would overflow the viewport. */
  position?: TooltipPosition;
  /** Additional className forwarded to the wrapper span. */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Gap (px) between the trigger element and the tooltip bubble. */
const GAP = 8;
/** Minimum margin (px) from each viewport edge before triggering a flip. */
const VIEWPORT_MARGIN = 12;
/** Tooltip max-width in px (matches Tailwind w-56 = 224px). */
const TOOLTIP_MAX_WIDTH = 224;
/** Estimated min tooltip height for initial flip calculations. */
const TOOLTIP_MIN_HEIGHT = 40;

// ============================================================================
// Helpers
// ============================================================================

interface Coords {
  top: number;
  left: number;
}

/**
 * Compute the pixel position (top/left) of the tooltip given the trigger's
 * bounding rect and the resolved position. Falls back to viewport centre on
 * SSR / missing ref.
 */
function computePosition(
  triggerRect: DOMRect,
  tooltipEl: HTMLElement | null,
  position: TooltipPosition,
): Coords {
  const tooltipW = tooltipEl?.offsetWidth ?? TOOLTIP_MAX_WIDTH;
  const tooltipH = tooltipEl?.offsetHeight ?? TOOLTIP_MIN_HEIGHT;

  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = triggerRect.top + window.scrollY - tooltipH - GAP;
      left =
        triggerRect.left +
        window.scrollX +
        triggerRect.width / 2 -
        tooltipW / 2;
      break;
    case 'bottom':
      top = triggerRect.bottom + window.scrollY + GAP;
      left =
        triggerRect.left +
        window.scrollX +
        triggerRect.width / 2 -
        tooltipW / 2;
      break;
    case 'left':
      top =
        triggerRect.top +
        window.scrollY +
        triggerRect.height / 2 -
        tooltipH / 2;
      left = triggerRect.left + window.scrollX - tooltipW - GAP;
      break;
    case 'right':
      top =
        triggerRect.top +
        window.scrollY +
        triggerRect.height / 2 -
        tooltipH / 2;
      left = triggerRect.right + window.scrollX + GAP;
      break;
  }

  return { top, left };
}

/**
 * Determine the effective tooltip position, flipping the preferred position if
 * it would overflow the visible viewport.
 */
function resolvePosition(
  triggerRect: DOMRect,
  preferred: TooltipPosition,
  tooltipEl: HTMLElement | null,
): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipH = tooltipEl?.offsetHeight ?? TOOLTIP_MIN_HEIGHT;
  const tooltipW = tooltipEl?.offsetWidth ?? TOOLTIP_MAX_WIDTH;

  const opposite: Record<TooltipPosition, TooltipPosition> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };

  const wouldOverflow = (pos: TooltipPosition): boolean => {
    switch (pos) {
      case 'top':
        return triggerRect.top - tooltipH - GAP < VIEWPORT_MARGIN;
      case 'bottom':
        return triggerRect.bottom + tooltipH + GAP > vh - VIEWPORT_MARGIN;
      case 'left':
        return triggerRect.left - tooltipW - GAP < VIEWPORT_MARGIN;
      case 'right':
        return triggerRect.right + tooltipW + GAP > vw - VIEWPORT_MARGIN;
    }
  };

  if (wouldOverflow(preferred)) {
    const flipped = opposite[preferred];
    // Only flip if the opposite side has room
    if (!wouldOverflow(flipped)) return flipped;
  }

  return preferred;
}

/**
 * Clamp a coordinate so the tooltip stays within the visible viewport (with
 * the VIEWPORT_MARGIN buffer).
 */
function clampCoords(
  coords: Coords,
  tooltipEl: HTMLElement | null,
): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = tooltipEl?.offsetWidth ?? TOOLTIP_MAX_WIDTH;
  const tooltipH = tooltipEl?.offsetHeight ?? TOOLTIP_MIN_HEIGHT;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    left: Math.max(
      scrollX + VIEWPORT_MARGIN,
      Math.min(coords.left, scrollX + vw - tooltipW - VIEWPORT_MARGIN),
    ),
    top: Math.max(
      scrollY + VIEWPORT_MARGIN,
      Math.min(coords.top, scrollY + vh - tooltipH - VIEWPORT_MARGIN),
    ),
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Reusable tooltip that wraps any trigger element and displays a help bubble.
 *
 * @example
 * <Tooltip content="Total $FNDRY tokens earned from completed bounties">
 *   <span>Total Earned</span>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const [resolvedPos, setResolvedPos] = useState<TooltipPosition>(position);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobileRef = useRef(false);

  const tooltipId = useId();

  // ── Positioning ────────────────────────────────────────────────────────────

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    const effectivePos = resolvePosition(triggerRect, position, tooltipEl);
    const raw = computePosition(triggerRect, tooltipEl, effectivePos);
    const clamped = clampCoords(raw, tooltipEl);

    setResolvedPos(effectivePos);
    setCoords(clamped);
  }, [position]);

  // Recalculate whenever tooltip becomes visible or window resizes/scrolls
  useEffect(() => {
    if (!visible) return;

    updatePosition();

    // Re-run after the tooltip has rendered (so we have real dimensions)
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, updatePosition]);

  // ── Show / Hide ────────────────────────────────────────────────────────────

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setVisible(false), 80);
  }, []);

  // ── Click-outside (mobile tap-to-toggle) ───────────────────────────────────

  useEffect(() => {
    if (!visible || !isMobileRef.current) return;

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [visible]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ── Event Handlers ─────────────────────────────────────────────────────────

  // Detect mobile via pointer type on first interaction
  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      isMobileRef.current = e.pointerType === 'touch';
      if (e.pointerType !== 'touch') show();
    },
    [show],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') hide();
    },
    [hide],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only toggle on touch-initiated click; desktop relies on hover
      if (isMobileRef.current) {
        e.stopPropagation();
        if (visible) {
          setVisible(false);
        } else {
          show();
        }
      }
    },
    [visible, show],
  );

  const handleFocus = useCallback(() => {
    isMobileRef.current = false;
    show();
  }, [show]);

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    },
    [],
  );

  // ── Arrow direction class (points from bubble toward trigger) ───────────────

  const arrowClasses: Record<TooltipPosition, string> = {
    top: [
      'absolute left-1/2 -translate-x-1/2 -bottom-1.5',
      'border-l-[6px] border-l-transparent',
      'border-r-[6px] border-r-transparent',
      'border-t-[6px] border-t-gray-800 dark:border-t-gray-700',
    ].join(' '),
    bottom: [
      'absolute left-1/2 -translate-x-1/2 -top-1.5',
      'border-l-[6px] border-l-transparent',
      'border-r-[6px] border-r-transparent',
      'border-b-[6px] border-b-gray-800 dark:border-b-gray-700',
    ].join(' '),
    left: [
      'absolute top-1/2 -translate-y-1/2 -right-1.5',
      'border-t-[6px] border-t-transparent',
      'border-b-[6px] border-b-transparent',
      'border-l-[6px] border-l-gray-800 dark:border-l-gray-700',
    ].join(' '),
    right: [
      'absolute top-1/2 -translate-y-1/2 -left-1.5',
      'border-t-[6px] border-t-transparent',
      'border-b-[6px] border-b-transparent',
      'border-r-[6px] border-r-gray-800 dark:border-r-gray-700',
    ].join(' '),
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tooltipEl = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      data-position={resolvedPos}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        // Override fixed to absolute within scroll context:
        // we already add scrollY/scrollX in computePosition so use 'absolute'
        // but portal is appended to body → fixed is correct here.
        zIndex: 9999,
        maxWidth: TOOLTIP_MAX_WIDTH,
        // Use 'fixed' so it doesn't scroll with the page
        pointerEvents: 'none',
      }}
      className={[
        // Visibility / animation
        'transition-all duration-150 ease-out',
        visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-1 scale-95 pointer-events-none',
        // Bubble styling — light and dark theme
        'relative w-max max-w-56',
        'rounded-lg px-3 py-2 text-xs leading-snug font-medium',
        'bg-gray-800 text-gray-100 shadow-lg ring-1 ring-white/10',
        'dark:bg-gray-700 dark:text-gray-100 dark:ring-white/10',
      ].join(' ')}
      aria-hidden={!visible}
    >
      {content}
      {/* Arrow */}
      <span className={arrowClasses[resolvedPos]} aria-hidden="true" />
    </div>
  );

  return (
    <>
      <span
        ref={wrapperRef}
        className={['inline-flex items-center', className].filter(Boolean).join(' ')}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-describedby={visible ? tooltipId : undefined}
        // Allow the wrapper to receive focus for keyboard users when the
        // children themselves aren't focusable (e.g. plain text spans)
        tabIndex={0}
      >
        {children}
      </span>

      {typeof document !== 'undefined' &&
        createPortal(tooltipEl, document.body)}
    </>
  );
}

export default Tooltip;

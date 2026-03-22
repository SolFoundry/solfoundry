/**
 * Tooltip — Reusable tooltip component with viewport-aware positioning.
 * Supports desktop hover and mobile tap. Matches dark/light theme.
 * @module components/common/Tooltip
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content displayed inside the tooltip */
  content: string;
  /** The element that triggers the tooltip */
  children: ReactNode;
  /** Preferred position of the tooltip (may flip to avoid viewport overflow) */
  position?: TooltipPosition;
  /** Additional CSS class names for the tooltip container */
  className?: string;
  /** Delay in milliseconds before showing the tooltip on hover */
  delay?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum distance from viewport edge (in px) before flipping position */
const VIEWPORT_PADDING = 8;

/** Default delay before showing tooltip */
const DEFAULT_DELAY = 150;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determines the best position for the tooltip to avoid viewport overflow.
 * Falls back to the opposite side if the preferred position would clip.
 */
function resolvePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPosition,
): TooltipPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const fits: Record<TooltipPosition, boolean> = {
    top: triggerRect.top - tooltipRect.height - VIEWPORT_PADDING > 0,
    bottom: triggerRect.bottom + tooltipRect.height + VIEWPORT_PADDING < viewportHeight,
    left: triggerRect.left - tooltipRect.width - VIEWPORT_PADDING > 0,
    right: triggerRect.right + tooltipRect.width + VIEWPORT_PADDING < viewportWidth,
  };

  if (fits[preferred]) return preferred;

  // Try opposite side first, then fall back to other axes
  const fallbackOrder: Record<TooltipPosition, TooltipPosition[]> = {
    top: ['bottom', 'right', 'left'],
    bottom: ['top', 'right', 'left'],
    left: ['right', 'top', 'bottom'],
    right: ['left', 'top', 'bottom'],
  };

  for (const candidate of fallbackOrder[preferred]) {
    if (fits[candidate]) return candidate;
  }

  return preferred;
}

/**
 * Returns inline styles for positioning the tooltip relative to its trigger.
 */
function getPositionStyles(position: TooltipPosition): React.CSSProperties {
  switch (position) {
    case 'top':
      return {
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
      };
    case 'bottom':
      return {
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: '8px',
      };
    case 'left':
      return {
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: '8px',
      };
    case 'right':
      return {
        left: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginLeft: '8px',
      };
  }
}

/**
 * Returns the CSS class for the tooltip arrow based on position.
 */
function getArrowClass(position: TooltipPosition): string {
  const base = 'absolute w-2 h-2 rotate-45 bg-gray-800 dark:bg-gray-800 light:bg-white border';
  switch (position) {
    case 'top':
      return `${base} border-t-0 border-l-0 border-gray-700 dark:border-gray-700 -bottom-1 left-1/2 -translate-x-1/2`;
    case 'bottom':
      return `${base} border-b-0 border-r-0 border-gray-700 dark:border-gray-700 -top-1 left-1/2 -translate-x-1/2`;
    case 'left':
      return `${base} border-b-0 border-l-0 border-gray-700 dark:border-gray-700 -right-1 top-1/2 -translate-y-1/2`;
    case 'right':
      return `${base} border-t-0 border-r-0 border-gray-700 dark:border-gray-700 -left-1 top-1/2 -translate-y-1/2`;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Tooltip component that displays helpful text on hover (desktop) or tap (mobile).
 * Automatically repositions to avoid viewport overflow. Supports dark and light themes.
 *
 * @example
 * ```tsx
 * <Tooltip content="Total $FNDRY earned from merged bounty PRs">
 *   <span>Total Earned</span>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  position: preferredPosition = 'top',
  className = '',
  delay = DEFAULT_DELAY,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedPos, setResolvedPos] = useState<TooltipPosition>(preferredPosition);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchDevice = useRef(false);

  // Resolve position based on viewport bounds when tooltip becomes visible
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const bestPosition = resolvePosition(triggerRect, tooltipRect, preferredPosition);
    setResolvedPos(bestPosition);
  }, [isVisible, preferredPosition]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsVisible(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    isTouchDevice.current = true;
    setIsVisible((prev) => !prev);
  }, []);

  // Close tooltip when tapping outside on mobile
  useEffect(() => {
    if (!isVisible || !isTouchDevice.current) return;

    function handleOutsideTouch(e: TouchEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    }

    document.addEventListener('touchstart', handleOutsideTouch);
    return () => document.removeEventListener('touchstart', handleOutsideTouch);
  }, [isVisible]);

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={handleTouchStart}
      onFocus={show}
      onBlur={hide}
      role="button"
      tabIndex={0}
      aria-describedby={isVisible ? 'tooltip' : undefined}
    >
      {children}

      <div
        ref={tooltipRef}
        id="tooltip"
        role="tooltip"
        className={`
          absolute z-50 pointer-events-none
          max-w-xs px-3 py-2 text-xs font-medium leading-relaxed
          text-gray-100 bg-gray-800 dark:bg-gray-800 dark:text-gray-100
          border border-gray-700 dark:border-gray-700
          rounded-lg shadow-lg
          transition-all duration-200 ease-out
          ${isVisible
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 invisible'
          }
        `}
        style={{
          ...getPositionStyles(resolvedPos),
          whiteSpace: 'normal',
          minWidth: '140px',
        }}
      >
        {content}
        <span className={getArrowClass(resolvedPos)} />
      </div>
    </div>
  );
}

/**
 * Tooltip — A reusable tooltip component with no external dependencies.
 * Supports hover (desktop) and tap (mobile), with configurable positioning.
 * @module components/ui/Tooltip
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The text content to display inside the tooltip bubble. */
  content: string;
  /** The element(s) that trigger the tooltip on hover or tap. */
  children: React.ReactNode;
  /** Where to place the tooltip relative to the trigger element. Defaults to 'top'. */
  position?: TooltipPosition;
  /** Optional additional class names for the wrapper element. */
  className?: string;
}

// ============================================================================
// Position Styles
// ============================================================================

/**
 * Returns Tailwind classes for positioning and transforming the tooltip bubble
 * based on the requested direction.
 */
function getPositionClasses(position: TooltipPosition): {
  tooltip: string;
  arrow: string;
} {
  switch (position) {
    case 'bottom':
      return {
        tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',
        arrow:
          'bottom-full left-1/2 -translate-x-1/2 border-b-[#2a2a2a] border-x-transparent border-t-transparent',
      };
    case 'left':
      return {
        tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',
        arrow:
          'left-full top-1/2 -translate-y-1/2 border-l-[#2a2a2a] border-y-transparent border-r-transparent',
      };
    case 'right':
      return {
        tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',
        arrow:
          'right-full top-1/2 -translate-y-1/2 border-r-[#2a2a2a] border-y-transparent border-l-transparent',
      };
    case 'top':
    default:
      return {
        tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        arrow:
          'top-full left-1/2 -translate-x-1/2 border-t-[#2a2a2a] border-x-transparent border-b-transparent',
      };
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Tooltip wraps any child element and shows a text bubble on hover (desktop)
 * or tap (mobile). No external libraries are required — positioning and
 * animation are handled with Tailwind CSS utility classes.
 *
 * @example
 * <Tooltip content="Total $FNDRY tokens distributed" position="top">
 *   <StatCard label="Total Paid" value="1.2M" />
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tooltip: tooltipClasses, arrow: arrowClasses } =
    getPositionClasses(position);

  // Clear any pending hide timer on unmount to avoid state updates on unmounted
  // components.
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    // Small delay so the tooltip does not flicker when moving between elements.
    hideTimerRef.current = setTimeout(() => setVisible(false), 80);
  }, []);

  // Toggle on tap for mobile — prevent the tap from bubbling so it does not
  // immediately re-close via a document click listener.
  const handleTap = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setVisible((prev) => !prev);
    },
    []
  );

  // Close on any outside click while visible.
  useEffect(() => {
    if (!visible) return;
    const close = () => setVisible(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [visible]);

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={handleTap}
    >
      {children}

      {/* Tooltip bubble */}
      <div
        role="tooltip"
        aria-hidden={!visible}
        className={[
          'absolute z-50 w-max max-w-[220px] px-3 py-1.5',
          'bg-[#2a2a2a] border border-white/10 rounded-lg',
          'text-xs text-white/90 leading-snug shadow-lg',
          'pointer-events-none select-none',
          'transition-opacity duration-150',
          tooltipClasses,
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {content}

        {/* Arrow */}
        <span
          className={[
            'absolute w-0 h-0',
            'border-4',
            arrowClasses,
          ].join(' ')}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Tooltip;

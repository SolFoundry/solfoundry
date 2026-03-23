/**
 * Reusable Tooltip component
 * - No external dependencies
 * - Hover (desktop) + tap (mobile) support
 * - Viewport overflow prevention (positions above/below/left/right)
 * - Dark/light theme aware via Tailwind dark: variant
 * - Smooth fade-in animation via Tailwind opacity transition
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface TooltipProps {
  /** The content to display inside the tooltip bubble */
  content: string;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Preferred position (auto-adjusts if viewport overflow detected) */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional additional class names for the trigger wrapper */
  className?: string;
}

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export function Tooltip({ content, children, position = 'top', className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [resolvedPosition, setResolvedPosition] = useState<TooltipPosition>(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  /** Resolve position to avoid viewport overflow */
  const resolvePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let preferred = position;

    // Check if preferred fits; if not, find a fitting one
    const fits: Record<TooltipPosition, boolean> = {
      top: trigger.top - tooltip.height - margin >= 0,
      bottom: trigger.bottom + tooltip.height + margin <= vh,
      left: trigger.left - tooltip.width - margin >= 0,
      right: trigger.right + tooltip.width + margin <= vw,
    };

    if (!fits[preferred]) {
      const fallback = (['top', 'bottom', 'left', 'right'] as TooltipPosition[]).find(
        (p) => fits[p]
      );
      if (fallback) preferred = fallback;
    }

    setResolvedPosition(preferred);
  }, [position]);

  const show = useCallback(() => {
    setVisible(true);
    // Resolve position on next frame (tooltip must be rendered first)
    requestAnimationFrame(resolvePosition);
  }, [resolvePosition]);

  const hide = useCallback(() => setVisible(false), []);

  /** Mobile tap-outside to dismiss */
  useEffect(() => {
    if (!visible) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [visible, hide]);

  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 dark:border-t-gray-100 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 dark:border-b-gray-100 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800 dark:border-l-gray-100 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800 dark:border-r-gray-100 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      /* Mobile tap toggles tooltip */
      onTouchStart={(e) => {
        e.preventDefault();
        visible ? hide() : show();
      }}
    >
      {children}

      {/* Tooltip bubble */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={!visible}
        className={[
          'absolute z-50 w-max max-w-[14rem] px-3 py-2 text-xs font-medium rounded-lg shadow-lg',
          'bg-gray-800 text-white',
          'dark:bg-gray-100 dark:text-gray-900',
          'pointer-events-none select-none',
          'transition-opacity duration-150',
          positionClasses[resolvedPosition],
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {content}
        {/* Arrow */}
        <span
          aria-hidden="true"
          className={[
            'absolute border-4',
            arrowClasses[resolvedPosition],
          ].join(' ')}
        />
      </div>
    </div>
  );
}

export default Tooltip;

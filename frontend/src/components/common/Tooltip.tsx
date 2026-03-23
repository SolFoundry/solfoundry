/**
 * Reusable Tooltip component — no external dependencies.
 *
 * Features:
 * - Hover-triggered on desktop, tap-triggered on mobile
 * - Repositions automatically to stay within the viewport
 * - Follows the current dark/light theme
 * - Smooth fade-in animation
 *
 * @module components/common/Tooltip
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The text or React node to display inside the tooltip. */
  content: React.ReactNode;
  /** The element the tooltip wraps. */
  children: React.ReactNode;
  /** Preferred placement — will flip automatically if it overflows. */
  position?: TooltipPosition;
  /** Extra CSS classes for the tooltip bubble. */
  className?: string;
  /** Delay (ms) before showing the tooltip on hover. */
  delay?: number;
}

// ── Offset & margin constants ────────────────────────────────────────────────

const TOOLTIP_GAP = 8; // px between trigger and tooltip bubble
const VIEWPORT_MARGIN = 8; // min px from viewport edge

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Tooltip — displays a brief explanation next to a trigger element.
 *
 * Desktop: appears on mouseenter, hides on mouseleave.
 * Mobile: appears on tap, hides on outside tap or scroll.
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
  delay = 0,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Positioning ──────────────────────────────────────────────────────────

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let pos = position;

    // Flip if there isn't enough room
    if (pos === 'top' && triggerRect.top - tooltipRect.height - TOOLTIP_GAP < VIEWPORT_MARGIN) {
      pos = 'bottom';
    } else if (pos === 'bottom' && triggerRect.bottom + tooltipRect.height + TOOLTIP_GAP > window.innerHeight - VIEWPORT_MARGIN) {
      pos = 'top';
    } else if (pos === 'left' && triggerRect.left - tooltipRect.width - TOOLTIP_GAP < VIEWPORT_MARGIN) {
      pos = 'right';
    } else if (pos === 'right' && triggerRect.right + tooltipRect.width + TOOLTIP_GAP > window.innerWidth - VIEWPORT_MARGIN) {
      pos = 'left';
    }

    setAdjustedPos(pos);
  }, [position]);

  useEffect(() => {
    if (isVisible) reposition();
  }, [isVisible, reposition]);

  // ── Show / hide logic ────────────────────────────────────────────────────

  const show = useCallback(() => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(true);
    }
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Mobile: close on outside tap or scroll
  useEffect(() => {
    if (!isVisible) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        hide();
      }
    };

    const handleScroll = () => hide();

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible, hide]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── Position styles ──────────────────────────────────────────────────────

  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent',
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={(e) => {
        e.stopPropagation();
        setIsVisible((v) => !v);
      }}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-xs font-medium leading-snug
            text-white dark:text-gray-100
            bg-gray-900 dark:bg-gray-700
            rounded-lg shadow-lg
            whitespace-nowrap pointer-events-none
            animate-tooltip-fade-in
            ${positionClasses[adjustedPos]}
            ${className}
          `}
        >
          {content}
          {/* Arrow */}
          <span
            className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPos]}`}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

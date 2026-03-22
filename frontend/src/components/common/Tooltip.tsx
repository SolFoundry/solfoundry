import React, { useState, useRef, useCallback, useEffect } from 'react';

interface TooltipProps {
  /** The text displayed inside the tooltip. */
  content: string;
  /** Where to place the tooltip relative to the trigger element. */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in ms before the tooltip appears on hover. */
  delayMs?: number;
  /** The element that triggers the tooltip. */
  children: React.ReactNode;
}

/**
 * Reusable Tooltip component — no external dependencies.
 *
 * Shows on hover (desktop) and tap (mobile). Automatically repositions
 * to stay inside the viewport. Supports dark/light theme and has a
 * smooth fade-in animation.
 */
export default function Tooltip({
  content,
  position = 'top',
  delayMs = 200,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  // Tap support for mobile — toggle on touch.
  const handleTouch = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setVisible((v) => !v);
    },
    [],
  );

  // Close on outside click / tap (mobile).
  useEffect(() => {
    if (!visible) return;
    const handleOutside = (e: Event) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [visible]);

  // Viewport-overflow detection — shift position when it would clip.
  useEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return;

    const tt = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let next = position;
    if (position === 'top' && tt.top < 0) next = 'bottom';
    if (position === 'bottom' && tt.bottom > vh) next = 'top';
    if (position === 'left' && tt.left < 0) next = 'right';
    if (position === 'right' && tt.right > vw) next = 'left';

    if (next !== adjustedPosition) setAdjustedPosition(next);
  }, [visible, position, adjustedPosition]);

  // Reset adjusted position when the preferred position prop changes.
  useEffect(() => {
    setAdjustedPosition(position);
  }, [position]);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-200 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-200 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-200 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-200 border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={handleTouch}
    >
      {children}

      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 ${positionClasses[adjustedPosition]} pointer-events-none transition-opacity duration-150 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="px-3 py-2 text-xs font-medium rounded-lg shadow-lg max-w-xs text-white dark:text-gray-900 bg-gray-900 dark:bg-gray-200 whitespace-normal">
            {content}
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPosition]}`}
          />
        </div>
      )}
    </div>
  );
}

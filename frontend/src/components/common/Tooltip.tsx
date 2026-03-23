/**
 * Tooltip - Reusable tooltip component with hover and mobile tap support
 * 
 * @module components/common/Tooltip
 */
import { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  /** Content to show in tooltip */
  content: string;
  /** Element that triggers the tooltip */
  children: React.ReactNode;
  /** Optional CSS class for styling */
  className?: string;
  /** Tooltip position: top, bottom, left, right */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({
  content,
  children,
  className = '',
  position = 'top',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Adjust position to avoid viewport overflow
  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newPosition = position;

      // Check for overflow
      if (position === 'top' && tooltipRect.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && tooltipRect.bottom > viewportHeight) {
        newPosition = 'top';
      } else if (position === 'left' && tooltipRect.left < 0) {
        newPosition = 'right';
      } else if (position === 'right' && tooltipRect.right > viewportWidth) {
        newPosition = 'left';
      }

      if (newPosition !== actualPosition) {
        setActualPosition(newPosition);
      }
    }
  }, [isVisible, position, actualPosition]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200 ${positionClasses[actualPosition]}`}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[actualPosition]}`}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

export default Tooltip;

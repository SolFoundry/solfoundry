/**
 * ScrollToTop - A button component that appears when user scrolls down
 * and allows smooth scrolling back to the top of the page.
 * 
 * Features:
 * - Appears after scrolling past threshold (300px)
 * - Smooth scroll animation to top
 * - Dark theme styling with gradient
 * - Responsive design
 * - Accessible with proper ARIA labels
 */
import React, { useState, useEffect, useCallback } from 'react';

interface ScrollToTopProps {
  /** Scroll threshold in pixels before button appears (default: 300) */
  threshold?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ScrollToTop({ threshold = 300, className = '' }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Check scroll position and update visibility
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  // Smooth scroll to top
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToTop();
      }
    },
    [scrollToTop]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      onKeyDown={handleKeyDown}
      className={`
        fixed z-40
        bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]
        right-[max(1.5rem,env(safe-area-inset-right,0px))]
        w-12 h-12 sm:w-14 sm:h-14
        rounded-full
        bg-gradient-to-br from-solana-purple to-solana-green
        text-white
        shadow-lg shadow-solana-purple/30
        hover:shadow-xl hover:shadow-solana-purple/40
        hover:scale-110
        active:scale-95
        transition-all duration-200 ease-out
        flex items-center justify-center
        focus:outline-none focus:ring-2 focus:ring-solana-green focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface
        ${className}
      `}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 15.75l7.5-7.5 7.5 7.5"
        />
      </svg>
    </button>
  );
}

export default ScrollToTop;
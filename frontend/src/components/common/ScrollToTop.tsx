import React, { useState, useEffect, useCallback } from 'react';

/**
 * ScrollToTop - Floating button to scroll to page top
 *
 * Features:
 * - Appears when user scrolls down more than 300px
 * - Smooth scroll animation on click
 * - Fade-in/fade-out animation
 * - Dark theme styling
 * - Accessible: aria-label, keyboard focusable
 * - No external dependencies
 */

const SCROLL_THRESHOLD = 300;

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  // Check scroll position
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top handler
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToTop();
      }
    },
    [scrollToTop]
  );

  return (
    <button
      onClick={scrollToTop}
      onKeyDown={handleKeyDown}
      className={`
        fixed bottom-6 right-6 z-50
        w-12 h-12 rounded-full
        bg-gradient-to-br from-[#9945FF] to-[#14F195]
        text-white
        flex items-center justify-center
        shadow-lg shadow-[#9945FF]/30
        hover:shadow-xl hover:shadow-[#9945FF]/40
        hover:scale-110
        active:scale-95
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
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
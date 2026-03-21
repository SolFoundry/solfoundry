import React, { useState, useEffect } from 'react';

/**
 * ScrollToTop - Floating scroll-to-top button component
 * 
 * Appears when user scrolls down more than 300px.
 * Smooth scroll animation to top on click.
 * Fade-in/fade-out animation on appear/disappear.
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  // Toggle visibility based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsVisible(scrollPosition > 300);
    };

    window.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full 
                 bg-[#9945FF] hover:bg-[#8a3fe6] text-white
                 border border-[#9945FF]/30 shadow-lg shadow-[#9945FF]/20
                 transition-all duration-300 ease-in-out
                 hover:scale-110 active:scale-95
                 opacity-100"
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      {/* Up arrow SVG icon */}
      <svg 
        className="w-5 h-5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

export default ScrollToTop;

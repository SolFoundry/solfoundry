import { useState, useEffect } from 'react';

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

interface ViewportInfo {
  width: number;
  height: number;
  size: ViewportSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
};

function getViewportSize(width: number): ViewportSize {
  if (width < BREAKPOINTS.tablet) return 'mobile';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  return 'desktop';
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = getViewportSize(width);
    return {
      width,
      height,
      size,
      isMobile: size === 'mobile',
      isTablet: size === 'tablet',
      isDesktop: size === 'desktop',
    };
  });

  useEffect(() => {
    let rafId: number;
    let lastWidth = window.innerWidth;

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth !== lastWidth) {
        lastWidth = currentWidth;
        const height = window.innerHeight;
        const size = getViewportSize(currentWidth);
        setViewport({
          width: currentWidth,
          height,
          size,
          isMobile: size === 'mobile',
          isTablet: size === 'tablet',
          isDesktop: size === 'desktop',
        });
      }
    };

    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleResize);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return viewport;
}

export default useViewport;

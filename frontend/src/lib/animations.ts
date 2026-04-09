// Animation variants for Framer Motion

import type { Variants } from 'framer-motion';

/**
 * Fade in animation variant
 */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
};

/**
 * Card hover animation variant
 */
export const cardHover: Variants = {
  rest: { 
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
};

/**
 * Button hover animation variant
 */
export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  tap: { scale: 0.95 },
};

/**
 * Stagger container for lists
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

/**
 * Stagger item for list children
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
};

/**
 * Slide in from right
 */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

/**
 * Slide in from left
 */
export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

/**
 * Scale up animation
 */
export const scaleUp: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.25, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

/**
 * Pulse animation for alerts and notifications
 */
export const pulse: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

/**
 * Page transition animation for route changes
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: 'easeIn' }
  },
};

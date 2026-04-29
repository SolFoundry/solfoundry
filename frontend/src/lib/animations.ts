/**
 * Animation variants for Framer Motion
 */
import type { Variants } from 'framer-motion';

/**
 * Fade in animation
 */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/**
 * Fade in from bottom
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/**
 * Fade in from left
 */
export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

/**
 * Fade in from right
 */
export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

/**
 * Scale up animation
 */
export const scaleUp: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

/**
 * Card hover animation
 */
export const cardHover: Variants = {
  rest: { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  hover: {
    scale: 1.02,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    transition: { duration: 0.2 }
  },
};

/**
 * Stagger container for list animations
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/**
 * Stagger item for list animations
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/**
 * Page transition
 */
export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/**
 * Slide in from bottom (for modals/sheets)
 */
export const slideInBottom: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { y: '100%', transition: { duration: 0.2 } },
};

/**
 * Pop in animation (for badges/notifications)
 */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 15, stiffness: 300 }
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

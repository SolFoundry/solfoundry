import type { Variants } from 'framer-motion';

/** Fade in from zero opacity */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** Page-level transition (enter/exit) */
export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Staggered container — apply to parent */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

/** Staggered item — apply to children */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/** Card hover — subtle lift on hover */
export const cardHover: Variants = {
  rest: { scale: 1, boxShadow: '0 0 0 0 transparent' },
  hover: { scale: 1.015, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' },
};

/** Button hover/tap animation */
export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.97 },
};

/** Slide in from the right */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

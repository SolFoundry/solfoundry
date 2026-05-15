import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const cardHover: Variants = {
  rest: { y: 0, borderColor: 'var(--border, #1E1E2E)' },
  hover: {
    y: -4,
    borderColor: 'var(--border-hover, #2D2D44)',
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.14, ease: 'easeOut' } },
  tap: { scale: 0.98, transition: { duration: 0.08, ease: 'easeOut' } },
};

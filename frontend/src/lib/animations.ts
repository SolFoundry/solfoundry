import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12, ease: 'easeInOut' },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 18 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
};

export const cardHover: Variants = {
  rest: {
    y: 0,
    borderColor: 'var(--color-border)',
  },
  hover: {
    y: -3,
    borderColor: 'var(--color-border-hover)',
    transition: { duration: 0.16, ease: 'easeOut' },
  },
};

export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.08, ease: 'easeOut' },
  },
};

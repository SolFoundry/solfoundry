import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: 12,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export const cardHover: Variants = {
  rest: {
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  hover: {
    y: -4,
    scale: 1.01,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  tap: {
    scale: 0.99,
    transition: { duration: 0.12, ease: 'easeOut' },
  },
};

export const buttonHover: Variants = {
  rest: {
    scale: 1,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  hover: {
    scale: 1.02,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1, ease: 'easeOut' },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
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
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

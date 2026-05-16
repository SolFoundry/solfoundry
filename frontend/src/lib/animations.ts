import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.24, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: 'easeOut' },
  },
};

export const cardHover: Variants = {
  rest: { y: 0 },
  hover: {
    y: -3,
    transition: { duration: 0.16, ease: 'easeOut' },
  },
};

export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: { duration: 0.14, ease: 'easeOut' },
  },
  tap: { scale: 0.98 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 18 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: 'easeOut' },
  },
};

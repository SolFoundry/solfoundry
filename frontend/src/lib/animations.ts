import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const cardHover: Variants = {
  rest: { y: 0, borderColor: 'rgba(30, 30, 46, 1)' },
  hover: { y: -4, borderColor: 'rgba(0, 230, 118, 0.35)' },
};

export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.03 },
  tap: { scale: 0.98 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

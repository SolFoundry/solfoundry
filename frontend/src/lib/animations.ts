import type { Variants } from 'framer-motion';

const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easeOut } },
};

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOut } },
};

export const cardHover: Variants = {
  rest: { y: 0, borderColor: 'rgba(82, 82, 110, 0.55)' },
  hover: {
    y: -3,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    transition: { duration: 0.18, ease: easeOut },
  },
};

export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.16, ease: easeOut } },
  tap: { scale: 0.98 },
};

export const pageTransition = fadeIn;

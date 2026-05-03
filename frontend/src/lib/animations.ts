import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2 } },
};

export const pageTransition = fadeIn;

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem = fadeIn;

export const cardHover: Variants = {
  initial: { scale: 1 },
  animate: { scale: 1 },
  whileHover: { y: -3, transition: { duration: 0.2 } },
};

export const buttonHover: Variants = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

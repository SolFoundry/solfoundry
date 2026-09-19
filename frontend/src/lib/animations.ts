import type { Variants } from 'framer-motion';

/** Gentle fade-and-rise entrance. Usage: initial="initial" animate="animate". */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/** Card lift on hover. Usage: initial="rest" whileHover="hover". */
export const cardHover: Variants = {
  rest: { y: 0, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  hover: { y: -4, scale: 1.01, transition: { duration: 0.2, ease: 'easeOut' } },
};

/** Button press feedback. Usage: initial="rest" whileHover="hover" whileTap="tap". */
export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04, transition: { duration: 0.15, ease: 'easeOut' } },
  tap: { scale: 0.97, transition: { duration: 0.1 } },
};

/** Full-page enter/exit. Usage: initial="initial" animate="animate" exit="exit". */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Slide-in panel. Usage: initial="initial" animate="animate" exit="exit". */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 48 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: 48, transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Staggered list container — children use staggerItem. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

/** Staggered list item — parent must use staggerContainer. */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

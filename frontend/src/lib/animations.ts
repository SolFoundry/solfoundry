import { Variants } from 'framer-motion';

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
  }
};

export const cardHover: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
};

export const buttonHover: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.05, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }
};

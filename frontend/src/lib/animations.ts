export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
} as const;

export const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
} as const;

export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
} as const;

export const cardHover = {
  rest: { y: 0 },
  hover: {
    y: -4,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
  },
} as const;

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.15 } },
  tap: { scale: 0.98 },
} as const;



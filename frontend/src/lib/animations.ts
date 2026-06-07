export const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export const cardHover = {
  rest: { y: 0, borderColor: 'rgba(255, 255, 255, 0.1)' },
  hover: { y: -3, borderColor: 'rgba(0, 230, 118, 0.35)' },
};

export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.03 },
  tap: { scale: 0.98 },
};

export const slideInRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

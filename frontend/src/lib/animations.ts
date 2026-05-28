export const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

export const pageTransition = fadeIn;

export const cardHover = {
  rest: { y: 0 },
  hover: { y: -2, transition: { duration: 0.16 } },
};

export const buttonHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem = fadeIn;

export const slideInRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

import { Variants } from 'framer-motion';

export const cardHover: Variants = {
  rest: { y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)', borderColor: 'var(--color-border)' },
  hover: { 
    y: -4, 
    boxShadow: '0 10px 30px -10px rgba(0, 230, 118, 0.15)',
    borderColor: 'currentColor',
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  }
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  }
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.3 }
  }
};

export const scaleUp: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  }
};

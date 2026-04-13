import type { Variants } from 'framer-motion';

/**
 * Simple fade-in with upward slide.
 * Suitable for onboarding screens, modals, or inline content reveals.
 */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Page-level transition variants for framer-motion — fade-only enter/exit.
 * Use as the `variants` prop on a motion.div wrapping page content.
 */
export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Stagger container variants — apply to a parent motion.div to stagger
 * the animate transitions of its children.
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

/**
 * Single item variant for use within a staggerContainer.
 * Children of the container should use this as their `variants` prop.
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/**
 * Card hover effect — subtle lift + shadow on hover, rest state otherwise.
 * Apply to a motion.div wrapping a card element.
 */
export const cardHover: Variants = {
  rest: { scale: 1, boxShadow: '0 0 0 0 transparent' },
  hover: { scale: 1.015, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' },
};

/**
 * Button hover/tap micro-interaction — scale up on hover, scale down on tap.
 * Apply to a motion.button element.
 */
export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.97 },
};

/**
 * Slide-in from the right animation.
 * Use for notifications, drawers, or content entering from the side.
 */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

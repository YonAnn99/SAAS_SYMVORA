import type { Variants, Transition } from "motion/react";

export const easeOutTransition: Transition = {
  duration: 0.6,
  ease: "easeOut",
};

export const easeOutShort: Transition = {
  duration: 0.5,
  ease: "easeOut",
};

export const easeOutLong: Transition = {
  duration: 0.8,
  ease: "easeOut",
};

export const staggerContainer: Variants = {
  hidden: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInUpSmall: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInUpLarge: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

export const springIcon: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
};

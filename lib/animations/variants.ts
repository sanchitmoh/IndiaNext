/**
 * Animation Variants Library
 *
 * Reusable Framer Motion animation variants for common patterns.
 * All variants include reduced motion support.
 */

import { Variants } from 'framer-motion';
import { animationConfig } from './config';

/**
 * Fade in animation
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: animationConfig.duration.normal / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Fade in from bottom
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: animationConfig.duration.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Fade in from top
 */
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: animationConfig.duration.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Fade in from left
 */
export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: animationConfig.duration.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Fade in from right
 */
export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: animationConfig.duration.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Scale in animation
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: animationConfig.duration.normal / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Slide in from bottom
 */
export const slideIn: Variants = {
  hidden: { y: 50, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: animationConfig.duration.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Container for staggered children
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: animationConfig.stagger.normal / 1000,
      delayChildren: 0.1,
    },
  },
};

/**
 * Item within staggered container
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: animationConfig.duration.normal / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * Configuration for creating custom variants
 */
import type { Easing } from 'framer-motion';
export interface VariantConfig {
  from?: {
    opacity?: number;
    x?: number;
    y?: number;
    scale?: number;
    rotate?: number;
  };
  to?: {
    opacity?: number;
    x?: number;
    y?: number;
    scale?: number;
    rotate?: number;
  };
  duration?: number;
  ease?: Easing | Easing[];
  delay?: number;
}

/**
 * Factory function to create custom animation variants
 */
// Helper to map string easings to Framer Motion allowed values
const mapEase = (ease: any): Easing | Easing[] => {
  if (Array.isArray(ease)) return ease;
  if (ease === 'linear' || ease === 'easeIn' || ease === 'easeOut' || ease === 'easeInOut')
    return ease;
  // fallback to cubic-bezier array if string is a bezier
  if (typeof ease === 'string' && ease.startsWith('cubic-bezier')) {
    // Example: 'cubic-bezier(0.4, 0, 0.2, 1)' => [0.4, 0, 0.2, 1]
    const match = ease.match(/cubic-bezier\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(Number) as unknown as Easing;
    }
  }
  // fallback default
  return [0.16, 1, 0.3, 1];
};

export const createVariant = (config: VariantConfig): Variants => {
  const {
    from = { opacity: 0 },
    to = { opacity: 1 },
    duration = animationConfig.duration.normal,
    ease = [0.16, 1, 0.3, 1],
    delay = 0,
  } = config;

  return {
    hidden: from,
    visible: {
      ...to,
      transition: {
        duration: duration / 1000,
        ease: mapEase(ease),
        delay,
      },
    },
  };
};

/**
 * Create reduced motion variant
 * Removes transforms and reduces duration
 */
export const createReducedMotionVariant = (variant: Variants): Variants => {
  const _visible = variant.visible as any;

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.01, // Nearly instant
      },
    },
  };
};

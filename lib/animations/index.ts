/**
 * Animation System - Main Export
 *
 * Central export point for all animation utilities, hooks, and components.
 */

// Configuration
export {
  animationConfig,
  getAnimationDuration,
  getStaggerDelay,
  validateConfig,
  mergeConfig,
} from './config';
export type { AnimationConfig } from './config';

// Variants
export {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  slideIn,
  staggerContainer,
  staggerItem,
  createVariant,
  createReducedMotionVariant,
} from './variants';
export type { VariantConfig } from './variants';

// Hooks
export { useReducedMotion } from './hooks/useReducedMotion';
export { useScrollAnimation } from './hooks/useScrollAnimation';
export type { ScrollAnimationOptions, ScrollAnimationReturn } from './hooks/useScrollAnimation';
export { usePerformance } from './hooks/usePerformance';
export type { PerformanceMetrics } from './hooks/usePerformance';

// Context
export { AnimationProvider, useAnimationContext } from './context/AnimationProvider';

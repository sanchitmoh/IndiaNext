/**
 * Animation Configuration System
 *
 * Central configuration for all animations in the application.
 * Provides consistent timing, easing, and behavior across components.
 */

export interface AnimationConfig {
  duration: {
    instant: number; // 0ms - No animation
    fast: number; // 150ms - Quick interactions
    normal: number; // 300ms - Standard animations
    slow: number; // 500ms - Deliberate animations
    verySlow: number; // 800ms - Emphasis animations
  };
  easing: {
    linear: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    spring: { stiffness: number; damping: number };
  };
  stagger: {
    fast: number; // 30ms - Quick succession
    normal: number; // 50ms - Standard stagger
    slow: number; // 100ms - Deliberate stagger
  };
  viewport: {
    margin: string; // Margin before triggering scroll animations
    once: boolean; // Animate only once when entering viewport
  };
}

/**
 * Default animation configuration
 */
export const animationConfig: AnimationConfig = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    verySlow: 800,
  },
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: { stiffness: 300, damping: 20 },
  },
  stagger: {
    fast: 30,
    normal: 50,
    slow: 100,
  },
  viewport: {
    margin: '0px 0px -100px 0px',
    once: true,
  },
};

/**
 * Get animation duration by key
 */
export const getAnimationDuration = (key: keyof AnimationConfig['duration']): number => {
  return animationConfig.duration[key];
};

/**
 * Get stagger delay by key
 */
export const getStaggerDelay = (key: keyof AnimationConfig['stagger']): number => {
  return animationConfig.stagger[key];
};

/**
 * Validate animation configuration
 * Ensures all values are within acceptable ranges
 */
export const validateConfig = (config: Partial<AnimationConfig>): boolean => {
  try {
    // Validate duration values
    if (config.duration) {
      const durations = Object.values(config.duration);
      for (const duration of durations) {
        if (typeof duration !== 'number' || duration < 0 || duration > 2000) {
          console.error(`Invalid duration value: ${duration}. Must be between 0 and 2000ms.`);
          return false;
        }
      }
    }

    // Validate stagger values
    if (config.stagger) {
      const staggers = Object.values(config.stagger);
      for (const stagger of staggers) {
        if (typeof stagger !== 'number' || stagger < 0 || stagger > 200) {
          console.error(`Invalid stagger value: ${stagger}. Must be between 0 and 200ms.`);
          return false;
        }
      }
    }

    // Validate spring physics
    if (config.easing?.spring) {
      const { stiffness, damping } = config.easing.spring;
      if (stiffness < 0 || stiffness > 1000) {
        console.error(`Invalid spring stiffness: ${stiffness}. Must be between 0 and 1000.`);
        return false;
      }
      if (damping < 0 || damping > 100) {
        console.error(`Invalid spring damping: ${damping}. Must be between 0 and 100.`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating animation config:', error);
    return false;
  }
};

/**
 * Merge custom configuration with defaults
 */
export const mergeConfig = (custom: Partial<AnimationConfig>): AnimationConfig => {
  if (!validateConfig(custom)) {
    console.warn('Invalid custom config provided, using defaults');
    return animationConfig;
  }

  return {
    duration: { ...animationConfig.duration, ...custom.duration },
    easing: { ...animationConfig.easing, ...custom.easing },
    stagger: { ...animationConfig.stagger, ...custom.stagger },
    viewport: { ...animationConfig.viewport, ...custom.viewport },
  };
};

/**
 * useScrollAnimation Hook
 *
 * Hook for scroll-triggered animations using Intersection Observer.
 * Integrates with Framer Motion for smooth animations.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useAnimation } from 'framer-motion';
import { useAnimationContext } from '../context/AnimationProvider';

export interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface ScrollAnimationReturn {
  ref: React.RefObject<HTMLElement | null>;
  isInView: boolean;
  controls: ReturnType<typeof useAnimation>;
}

/**
 * Hook for scroll-triggered animations
 */
export const useScrollAnimation = (options: ScrollAnimationOptions = {}): ScrollAnimationReturn => {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -100px 0px',
    once = true,
    onEnter,
    onExit,
  } = options;

  const { reducedMotion } = useAnimationContext();
  const ref = useRef<HTMLElement>(null);
  const controls = useAnimation();
  const [hasAnimated, setHasAnimated] = useState(false);

  // Use Framer Motion's useInView hook
  const isInView = useInView(ref, {
    once: false, // We'll handle 'once' logic manually
    amount: threshold,
    margin: rootMargin as any, // Cast to correct type (MarginType)
  });

  useEffect(() => {
    const shouldAnimate = isInView && (!once || !hasAnimated);
    const shouldHide = !isInView && !once && hasAnimated;

    if (shouldAnimate) {
      // Element entered viewport
      controls.start('visible');
      onEnter?.();
      // Use queueMicrotask to defer state update
      if (!hasAnimated) {
        queueMicrotask(() => setHasAnimated(true));
      }
    } else if (shouldHide) {
      // Element exited viewport (only if once is false)
      controls.start('hidden');
      onExit?.();
    }
  }, [isInView, controls, once, hasAnimated, onEnter, onExit]);

  // If reduced motion is enabled, show content immediately
  useEffect(() => {
    if (reducedMotion) {
      controls.start('visible');
    }
  }, [reducedMotion, controls]);

  return {
    ref,
    isInView,
    controls,
  };
};

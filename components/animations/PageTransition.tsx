/**
 * PageTransition Component
 *
 * Wrapper component for smooth page transitions in Next.js App Router.
 * Supports fade, slide, and scale variants.
 */

'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAnimationContext } from '@/lib/animations/context/AnimationProvider';

type TransitionVariant = 'fade' | 'slide' | 'scale';

interface PageTransitionProps {
  children: ReactNode;
  variant?: TransitionVariant;
  duration?: number;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  variant = 'fade',
  duration,
}) => {
  const { config, reducedMotion } = useAnimationContext();

  const transitionDuration =
    duration !== undefined ? duration / 1000 : config.duration.normal / 1000;

  const selectedVariant = variants[variant];

  // If reduced motion, use instant transition
  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={selectedVariant}
      transition={{
        duration: transitionDuration,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * ScrollReveal Component
 *
 * Reveals content with animation when it enters the viewport.
 * Uses Intersection Observer for efficient scroll detection.
 */

'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useScrollAnimation } from '@/lib/animations/hooks/useScrollAnimation';
import { fadeIn, fadeInUp, fadeInLeft, fadeInRight } from '@/lib/animations/variants';

type RevealVariant = 'fadeIn' | 'fadeInUp' | 'fadeInLeft' | 'fadeInRight';

interface ScrollRevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  once?: boolean;
  className?: string;
}

const variantMap = {
  fadeIn,
  fadeInUp,
  fadeInLeft,
  fadeInRight,
};

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  variant = 'fadeInUp',
  delay = 0,
  once = true,
  className,
}) => {
  const { ref, controls } = useScrollAnimation({ once });
  const selectedVariant = variantMap[variant];

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial="hidden"
      animate={controls}
      variants={selectedVariant}
      transition={{
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

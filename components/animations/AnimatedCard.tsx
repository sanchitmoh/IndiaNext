/**
 * AnimatedCard Component
 *
 * Card component with hover elevation and translation effects.
 * Provides visual feedback for interactive cards.
 */

'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAnimationContext } from '@/lib/animations/context/AnimationProvider';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  onClick,
}) => {
  const { config, reducedMotion } = useAnimationContext();

  const hoverY = reducedMotion ? 0 : -4;
  const duration = config.duration.fast / 1000;

  return (
    <motion.div
      className={`${className} cursor-pointer`}
      whileHover={{
        y: hoverY,
        boxShadow: reducedMotion
          ? undefined
          : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
      }}
      transition={{
        duration,
        ease: [0.4, 0, 0.2, 1],
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

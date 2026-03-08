/**
 * StaggerList Component
 *
 * Component that staggers animations for list items.
 * Provides orchestrated reveal animations for multiple elements.
 */

'use client';

import React, { ReactNode, Children } from 'react';
import { motion } from 'framer-motion';
import { useAnimationContext } from '@/lib/animations/context/AnimationProvider';
import { staggerItem } from '@/lib/animations/variants';

type StaggerVariant = 'fadeIn' | 'slideIn';

interface StaggerListProps {
  children: ReactNode[];
  staggerDelay?: number;
  variant?: StaggerVariant;
  className?: string;
}

const MAX_ITEMS = 20; // Performance limit

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  staggerDelay,
  variant: _variant = 'fadeIn',
  className = '',
}) => {
  const { config, reducedMotion } = useAnimationContext();

  const childArray = Children.toArray(children);
  const itemCount = Math.min(childArray.length, MAX_ITEMS);

  // Warn if exceeding max items
  if (childArray.length > MAX_ITEMS) {
    console.warn(
      `StaggerList: ${childArray.length} items provided, but only ${MAX_ITEMS} will be animated for performance.`
    );
  }

  const delay = staggerDelay !== undefined ? staggerDelay / 1000 : config.stagger.normal / 1000;

  // If reduced motion, show all items immediately
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  // Custom stagger container with configurable delay
  const customStaggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={customStaggerContainer}
    >
      {childArray.slice(0, itemCount).map((child, index) => (
        <motion.div key={index} variants={staggerItem}>
          {child}
        </motion.div>
      ))}
      {/* Render remaining items without animation */}
      {childArray.slice(itemCount).map((child, index) => (
        <div key={`static-${index}`}>{child}</div>
      ))}
    </motion.div>
  );
};

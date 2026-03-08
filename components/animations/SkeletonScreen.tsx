/**
 * SkeletonScreen Component
 *
 * Loading skeleton components with shimmer animation.
 * Provides visual feedback during content loading.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

const shimmerAnimation = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity as number,
    ease: 'linear' as const,
  },
};

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-sm',
  card: 'h-48 rounded-lg',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width = '100%',
  height,
  count = 1,
  className = '',
}) => {
  const baseClasses = `
    bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800
    bg-[length:200%_100%]
    ${variantStyles[variant]}
    ${className}
  `.trim();

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  if (count === 1) {
    return <motion.div className={baseClasses} style={style} {...shimmerAnimation} />;
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div key={index} className={baseClasses} style={style} {...shimmerAnimation} />
      ))}
    </div>
  );
};

/**
 * Preset skeleton for card layout
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-6 border border-white/10 rounded-lg ${className}`}>
      <Skeleton variant="circular" width={48} height={48} className="mb-4" />
      <Skeleton variant="text" width="60%" className="mb-2" />
      <Skeleton variant="text" width="80%" className="mb-4" />
      <Skeleton variant="rectangular" height={100} />
    </div>
  );
};

/**
 * Preset skeleton for list items
 */
export const SkeletonList: React.FC<{ count: number; className?: string }> = ({
  count,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
};

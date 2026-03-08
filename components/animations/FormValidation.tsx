/**
 * FormValidation Component
 *
 * Form validation animations for error and success feedback.
 * Provides visual feedback with shake and slide animations.
 */

'use client';

import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useAnimationContext } from '@/lib/animations/context/AnimationProvider';

interface FormValidationProps {
  error?: string;
  success?: string;
  show: boolean;
  className?: string;
}

export const FormValidation: React.FC<FormValidationProps> = ({
  error,
  success,
  show,
  className = '',
}) => {
  const { config, reducedMotion } = useAnimationContext();

  if (!show || (!error && !success)) {
    return null;
  }

  const isError = !!error;
  const message = error || success;
  const bgColor = isError ? 'bg-red-500/10' : 'bg-green-500/10';
  const borderColor = isError ? 'border-red-500' : 'border-green-500';
  const textColor = isError ? 'text-red-400' : 'text-green-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: reducedMotion ? 0 : config.duration.fast / 1000,
      }}
      className={`
        ${bgColor} ${borderColor} ${textColor}
        border-l-4 p-3 rounded-sm text-sm
        ${className}
      `.trim()}
    >
      {message}
    </motion.div>
  );
};

/**
 * Hook for form field animations
 */
export const useFormAnimation = () => {
  const controls = useAnimation();
  const { config, reducedMotion } = useAnimationContext();

  const shake = async () => {
    if (reducedMotion) return;

    await controls.start({
      x: [-10, 10, -10, 10, 0],
      transition: {
        duration: config.duration.slow / 1000,
        ease: 'easeInOut',
      },
    });
  };

  const showSuccess = async () => {
    if (reducedMotion) return;

    await controls.start({
      scale: [1, 1.05, 1],
      transition: {
        duration: config.duration.normal / 1000,
      },
    });
  };

  const showError = async (_message: string) => {
    await shake();
  };

  return {
    controls,
    shake,
    showSuccess,
    showError,
  };
};

/**
 * Animated form field wrapper
 */
interface AnimatedFieldProps {
  children: React.ReactNode;
  error?: boolean;
  className?: string;
}

export const AnimatedField: React.FC<AnimatedFieldProps> = ({
  children,
  error = false,
  className = '',
}) => {
  const { controls, shake } = useFormAnimation();

  useEffect(() => {
    if (error) {
      shake();
    }
  }, [error, shake]);

  return (
    <motion.div animate={controls} className={className}>
      {children}
    </motion.div>
  );
};

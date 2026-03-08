/**
 * Animation Provider
 *
 * Global context provider for animation configuration and state.
 * Manages reduced motion preference, test mode, and performance metrics.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AnimationConfig, animationConfig as defaultConfig, mergeConfig } from '../config';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface PerformanceMetrics {
  fps: number;
  averageFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  droppedFrames: number;
}

interface AnimationContextValue {
  config: AnimationConfig;
  reducedMotion: boolean;
  testMode: boolean;
  performance: PerformanceMetrics;
  updateConfig: (config: Partial<AnimationConfig>) => void;
}

const AnimationContext = createContext<AnimationContextValue | undefined>(undefined);

interface AnimationProviderProps {
  children: ReactNode;
  config?: Partial<AnimationConfig>;
  testMode?: boolean;
}

export const AnimationProvider: React.FC<AnimationProviderProps> = ({
  children,
  config: customConfig,
  testMode = false,
}) => {
  const reducedMotion = useReducedMotion();
  const [config, setConfig] = useState<AnimationConfig>(() =>
    customConfig ? mergeConfig(customConfig) : defaultConfig
  );
  const [performance] = useState<PerformanceMetrics>({
    fps: 60,
    averageFrameTime: 16.67,
    minFrameTime: 16.67,
    maxFrameTime: 16.67,
    droppedFrames: 0,
  });

  // Update config function
  const updateConfig = (newConfig: Partial<AnimationConfig>) => {
    setConfig((prev) => mergeConfig({ ...prev, ...newConfig }));
  };

  // Adjust config for reduced motion
  useEffect(() => {
    if (reducedMotion) {
      setConfig((prev) => ({
        ...prev,
        duration: {
          instant: 0,
          fast: 0,
          normal: 0,
          slow: 0,
          verySlow: 0,
        },
      }));
    } else {
      const newConfig = customConfig ? mergeConfig(customConfig) : defaultConfig;
      setConfig(newConfig);
    }
  }, [reducedMotion, customConfig]);

  // Adjust config for test mode
  useEffect(() => {
    if (!testMode) return;

    const testConfig = {
      ...config,
      duration: {
        instant: 0,
        fast: 0,
        normal: 0,
        slow: 0,
        verySlow: 0,
      },
    };
    setConfig(testConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMode]);

  const value: AnimationContextValue = {
    config,
    reducedMotion,
    testMode,
    performance,
    updateConfig,
  };

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
};

/**
 * Hook to access animation context
 */
export const useAnimationContext = (): AnimationContextValue => {
  const context = useContext(AnimationContext);

  if (context === undefined) {
    throw new Error('useAnimationContext must be used within AnimationProvider');
  }

  return context;
};

/**
 * usePerformance Hook
 *
 * Hook for monitoring animation performance metrics.
 * Tracks FPS, frame times, and dropped frames.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface PerformanceMetrics {
  fps: number;
  averageFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  droppedFrames: number;
}

interface UsePerformanceReturn {
  metrics: PerformanceMetrics;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  reset: () => void;
}

const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS; // 16.67ms
const POOR_PERFORMANCE_THRESHOLD = 30; // FPS

/**
 * Hook for monitoring animation performance
 */
export const usePerformance = (): UsePerformanceReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    averageFrameTime: TARGET_FRAME_TIME,
    minFrameTime: TARGET_FRAME_TIME,
    maxFrameTime: TARGET_FRAME_TIME,
    droppedFrames: 0,
  });

  const monitoringRef = useRef(false);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const measureFrame = useCallback(function measureFrameCallback(timestamp: number): void {
    if (!monitoringRef.current) return;

    if (lastFrameTimeRef.current !== 0) {
      const frameTime = timestamp - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);

      // Keep only last 60 frames for calculation
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate metrics
      const frameTimes = frameTimesRef.current;
      const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      const minFrameTime = Math.min(...frameTimes);
      const maxFrameTime = Math.max(...frameTimes);
      const fps = Math.round(1000 / averageFrameTime);
      const droppedFrames = frameTimes.filter((time) => time > TARGET_FRAME_TIME * 1.5).length;

      setMetrics({
        fps,
        averageFrameTime,
        minFrameTime,
        maxFrameTime,
        droppedFrames,
      });

      // Log warning if performance is poor
      if (fps < POOR_PERFORMANCE_THRESHOLD) {
        console.warn(
          `[Animation Performance] Low FPS detected: ${fps}fps (target: ${TARGET_FPS}fps)`
        );
      }
    }

    lastFrameTimeRef.current = timestamp;
    animationFrameRef.current = requestAnimationFrame(measureFrameCallback);
  }, []);

  const startMonitoring = useCallback(() => {
    if (monitoringRef.current) return;

    monitoringRef.current = true;
    lastFrameTimeRef.current = 0;
    frameTimesRef.current = [];
    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, [measureFrame]);

  const stopMonitoring = useCallback(() => {
    monitoringRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    frameTimesRef.current = [];
    lastFrameTimeRef.current = 0;
    setMetrics({
      fps: 60,
      averageFrameTime: TARGET_FRAME_TIME,
      minFrameTime: TARGET_FRAME_TIME,
      maxFrameTime: TARGET_FRAME_TIME,
      droppedFrames: 0,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    metrics,
    startMonitoring,
    stopMonitoring,
    reset,
  };
};

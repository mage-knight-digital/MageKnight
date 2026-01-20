/**
 * usePixiManagers - Custom hook to manage PixiJS animation and particle managers
 *
 * This hook consolidates the management of PixiJS managers (AnimationManager,
 * ParticleManager, BackgroundAtmosphere) that were previously scattered across
 * multiple refs in PixiHexGrid.
 *
 * Benefits:
 * - Single source of truth for manager lifecycle
 * - Proper cleanup on unmount
 * - Cleaner component code with reduced ref explosion
 * - Reusable across components if needed
 *
 * Usage:
 *   const { animationManager, particleManager, background, initManagers, cleanup } = usePixiManagers();
 *
 *   useEffect(() => {
 *     if (app) {
 *       initManagers(app);
 *     }
 *     return cleanup;
 *   }, [app]);
 */

import { useRef, useCallback } from "react";
import type { Application, Ticker } from "pixi.js";
import { AnimationManager } from "../components/GameBoard/pixi/animations";
import { ParticleManager } from "../components/GameBoard/pixi/particles";
import { BackgroundAtmosphere } from "../components/GameBoard/pixi/background";

export interface PixiManagers {
  animationManager: AnimationManager | null;
  particleManager: ParticleManager | null;
  background: BackgroundAtmosphere | null;
}

export interface UsePixiManagersReturn extends PixiManagers {
  /** Initialize all managers with the given app and screen dimensions */
  initManagers: (app: Application, screenWidth: number, screenHeight: number) => PixiManagers;
  /** Clean up all managers */
  cleanup: () => void;
  /** Check if managers are initialized */
  isInitialized: boolean;
}

/**
 * Custom hook to manage PixiJS animation and particle managers.
 *
 * This consolidates the lifecycle management of:
 * - AnimationManager (tweening/easing)
 * - ParticleManager (particle effects)
 * - BackgroundAtmosphere (procedural background)
 */
export function usePixiManagers(): UsePixiManagersReturn {
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);
  const tickerRef = useRef<Ticker | null>(null);

  /**
   * Initialize all managers with the given PixiJS application.
   *
   * @param app - The PixiJS Application instance
   * @param screenWidth - Initial screen width for background
   * @param screenHeight - Initial screen height for background
   * @returns The initialized managers
   */
  const initManagers = useCallback((
    app: Application,
    screenWidth: number,
    screenHeight: number
  ): PixiManagers => {
    // Store ticker reference for cleanup
    tickerRef.current = app.ticker;

    // Create and attach AnimationManager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animationManagerRef.current = animManager;

    // Create and attach ParticleManager
    const particleManager = new ParticleManager();
    particleManager.attach(app.ticker);
    particleManagerRef.current = particleManager;

    // Create and initialize BackgroundAtmosphere
    const background = new BackgroundAtmosphere();
    background.initialize(screenWidth, screenHeight);
    background.attach(app.ticker);
    backgroundRef.current = background;

    return {
      animationManager: animManager,
      particleManager,
      background,
    };
  }, []);

  /**
   * Clean up all managers and release resources.
   * Safe to call multiple times.
   */
  const cleanup = useCallback(() => {
    // Clean up animation manager
    if (animationManagerRef.current) {
      animationManagerRef.current.cancelAll();
      animationManagerRef.current.detach();
      animationManagerRef.current = null;
    }

    // Clean up particle manager
    if (particleManagerRef.current) {
      particleManagerRef.current.clear();
      particleManagerRef.current.detach();
      particleManagerRef.current = null;
    }

    // Clean up background atmosphere
    if (backgroundRef.current) {
      if (tickerRef.current) {
        backgroundRef.current.detach(tickerRef.current);
      }
      backgroundRef.current.destroy();
      backgroundRef.current = null;
    }

    tickerRef.current = null;
  }, []);

  return {
    animationManager: animationManagerRef.current,
    particleManager: particleManagerRef.current,
    background: backgroundRef.current,
    initManagers,
    cleanup,
    isInitialized: animationManagerRef.current !== null,
  };
}

/**
 * Get current manager references (for use in callbacks/effects).
 * Returns refs that always have the current value.
 */
export function usePixiManagerRefs() {
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);

  const setManagers = useCallback((managers: PixiManagers) => {
    animationManagerRef.current = managers.animationManager;
    particleManagerRef.current = managers.particleManager;
    backgroundRef.current = managers.background;
  }, []);

  const clearManagers = useCallback(() => {
    animationManagerRef.current = null;
    particleManagerRef.current = null;
    backgroundRef.current = null;
  }, []);

  return {
    animationManagerRef,
    particleManagerRef,
    backgroundRef,
    setManagers,
    clearManagers,
  };
}

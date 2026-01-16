/**
 * Game Intro Sequence Context
 *
 * Coordinates the theatrical opening sequence when a game first loads:
 * 1. Tiles cascade onto the board (staggered by position)
 * 2. Enemies flip onto their hexes (after tiles settle)
 * 3. Tactic cards deal into hand (after enemies appear)
 *
 * This creates an Inscryption-style layered reveal that feels intentional
 * and polished rather than everything appearing at once.
 *
 * Phase transitions are now driven by the AnimationDispatcher events,
 * which fire when CSS animations actually complete (not estimated timing).
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useAnimationDispatcher } from "./AnimationDispatcherContext";

export type IntroPhase =
  | "idle"           // Before game loads
  | "tiles"          // Tiles are cascading in
  | "enemies"        // Enemies are flipping onto board
  | "tactics"        // Tactic cards are dealing
  | "complete";      // Intro sequence finished

interface GameIntroContextValue {
  /** Current phase of the intro sequence */
  phase: IntroPhase;
  /** Whether the intro sequence has completed (for components that just need to know if they should animate) */
  isIntroComplete: boolean;
  /** Start the intro sequence (called when game state first arrives) */
  startIntro: (tileCount: number, enemyCount: number) => void;
  /** Get the stagger delay for a tile based on its index */
  getTileDelay: (index: number) => number;
  /** Get the stagger delay for an enemy based on its index */
  getEnemyDelay: (index: number) => number;
}

const GameIntroContext = createContext<GameIntroContextValue | null>(null);

// Timing constants (in milliseconds) - used for stagger delays only
const TILE_STAGGER_MS = 120;        // Delay between each tile
const ENEMY_STAGGER_MS = 80;        // Delay between each enemy

export function GameIntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>("idle");
  const hasStarted = useRef(false);
  const { on: onAnimationEvent, emit: emitAnimationEvent } = useAnimationDispatcher();

  // Subscribe to animation events to drive phase transitions
  useEffect(() => {
    // When tiles animation completes, transition to enemies phase
    const unsubTiles = onAnimationEvent("tiles-complete", () => {
      setPhase("enemies");
    });

    // When enemies animation completes, transition to tactics phase
    const unsubEnemies = onAnimationEvent("enemies-complete", () => {
      setPhase("tactics");
    });

    // When tactics animation completes, transition to complete phase
    const unsubTactics = onAnimationEvent("tactics-complete", () => {
      setPhase("complete");
      emitAnimationEvent("intro-complete");
    });

    return () => {
      unsubTiles();
      unsubEnemies();
      unsubTactics();
    };
  }, [onAnimationEvent, emitAnimationEvent]);

  const startIntro = useCallback((tileCount: number, enemyCount: number) => {
    // Only run intro once per game session
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Handle edge case: no tiles or enemies to animate
    // In this case, we still need to progress through phases
    if (tileCount === 0) {
      // Skip directly to enemies phase if no tiles
      setPhase("enemies");
      emitAnimationEvent("tiles-complete");
    } else {
      // Start with tiles phase
      setPhase("tiles");
    }

    // Handle edge case: no enemies to animate
    if (enemyCount === 0) {
      // We'll emit enemies-complete right after tiles-complete
      // but only if tiles exist (otherwise we already moved to enemies)
      if (tileCount > 0) {
        // Register a one-time listener to emit enemies-complete after tiles
        const unsub = onAnimationEvent("tiles-complete", () => {
          emitAnimationEvent("enemies-complete");
          unsub();
        });
      } else {
        // No tiles AND no enemies - emit enemies-complete immediately
        emitAnimationEvent("enemies-complete");
      }
    }
  }, [emitAnimationEvent, onAnimationEvent]);

  const getTileDelay = useCallback((index: number): number => {
    return index * TILE_STAGGER_MS;
  }, []);

  const getEnemyDelay = useCallback((index: number): number => {
    // Return just the stagger delay for this enemy (relative to when enemies phase starts)
    return index * ENEMY_STAGGER_MS;
  }, []);

  const value: GameIntroContextValue = {
    phase,
    isIntroComplete: phase === "complete",
    startIntro,
    getTileDelay,
    getEnemyDelay,
  };

  return (
    <GameIntroContext.Provider value={value}>
      {children}
    </GameIntroContext.Provider>
  );
}

export function useGameIntro(): GameIntroContextValue {
  const context = useContext(GameIntroContext);
  if (!context) {
    throw new Error("useGameIntro must be used within a GameIntroProvider");
  }
  return context;
}

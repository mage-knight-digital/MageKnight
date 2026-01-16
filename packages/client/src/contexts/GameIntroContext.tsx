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
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

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
  /** Get the delay before tactic cards should start animating */
  getTacticsDelay: () => number;
}

const GameIntroContext = createContext<GameIntroContextValue | null>(null);

// Timing constants (in milliseconds)
const TILE_STAGGER_MS = 120;        // Delay between each tile
const TILE_ANIMATION_MS = 600;      // Duration of tile reveal animation
const ENEMY_STAGGER_MS = 80;        // Delay between each enemy
const ENEMY_ANIMATION_MS = 400;     // Duration of enemy flip animation
const PHASE_GAP_MS = 200;           // Brief pause between phases

export function GameIntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>("idle");
  const hasStarted = useRef(false);
  const timingRef = useRef({ tileCount: 0, enemyCount: 0 });

  const startIntro = useCallback((tileCount: number, enemyCount: number) => {
    // Only run intro once per game session
    if (hasStarted.current) return;
    hasStarted.current = true;

    timingRef.current = { tileCount, enemyCount };

    // Calculate timing
    // TODO: This setTimeout-based approach is unreliable - see docs/tickets/animation-event-dispatcher.md
    const tilesEndTime = tileCount * TILE_STAGGER_MS + TILE_ANIMATION_MS;
    const enemiesEndTime = tilesEndTime + PHASE_GAP_MS + enemyCount * ENEMY_STAGGER_MS + ENEMY_ANIMATION_MS;
    const tacticsAnimationTime = 500 + 6 * 80; // ~1 second for 6 cards

    // Phase 1: Tiles
    setPhase("tiles");

    // Phase 2: Enemies (after tiles + gap)
    setTimeout(() => {
      setPhase("enemies");
    }, tilesEndTime + PHASE_GAP_MS);

    // Phase 3: Tactics (after enemies + gap)
    setTimeout(() => {
      setPhase("tactics");
    }, enemiesEndTime + PHASE_GAP_MS);

    // Phase 4: Complete (after tactics have had time to deal)
    setTimeout(() => {
      setPhase("complete");
    }, enemiesEndTime + PHASE_GAP_MS + tacticsAnimationTime);

  }, []);

  const getTileDelay = useCallback((index: number): number => {
    return index * TILE_STAGGER_MS;
  }, []);

  const getEnemyDelay = useCallback((index: number): number => {
    // Return just the stagger delay for this enemy (relative to when enemies phase starts)
    // The phase transition handles waiting for tiles to finish
    return index * ENEMY_STAGGER_MS;
  }, []);

  const getTacticsDelay = useCallback((): number => {
    const { tileCount, enemyCount } = timingRef.current;
    const tilesEndTime = tileCount * TILE_STAGGER_MS + TILE_ANIMATION_MS;
    const enemiesEndTime = tilesEndTime + PHASE_GAP_MS + enemyCount * ENEMY_STAGGER_MS + ENEMY_ANIMATION_MS;
    return enemiesEndTime + PHASE_GAP_MS;
  }, []);

  const value: GameIntroContextValue = {
    phase,
    isIntroComplete: phase === "complete",
    startIntro,
    getTileDelay,
    getEnemyDelay,
    getTacticsDelay,
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

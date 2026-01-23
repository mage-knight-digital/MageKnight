/**
 * Game Intro Sequence Context
 *
 * Coordinates the theatrical opening sequence when a game first loads:
 * 1. Tiles cascade onto the board (staggered by position)
 * 2. Enemies flip onto their hexes (after tiles settle)
 * 3. Hero emerges through portal (dramatic entrance after enemies)
 * 4. Mana source dice reveal (players see available mana before choosing tactics)
 * 5. Tactic cards deal into hand (after mana source settles)
 * 6. UI elements settle in (end turn, deck/discard, carousel indicator)
 * 7. "The Hold" - a brief pause before the game becomes interactive
 *
 * This creates an Inscryption-style layered reveal that feels intentional
 * and polished rather than everything appearing at once.
 *
 * Phase transitions are now driven by the AnimationDispatcher events,
 * which fire when CSS animations actually complete (not estimated timing).
 *
 * Disney Animation Principles Applied:
 * - Staging: Direct attention through sequence (board → threats → hero entrance → resources → choices → tools)
 * - Anticipation: Hero portal builds tension before reveal, tactics wait for the moment
 * - Overlapping Action: UI elements animate during/after tactics, not as separate phase
 * - Follow-through: Elements settle with overshoot before resting
 * - The Hold: Brief pause at end lets everything "breathe" before interactivity
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useAnimationDispatcher } from "./AnimationDispatcherContext";

export type IntroPhase =
  | "idle" // Before game loads
  | "tiles" // Tiles are cascading in
  | "enemies" // Enemies are flipping onto board
  | "hero" // Hero is emerging through portal
  | "mana-source" // Mana source dice are revealing (before tactics so player can plan)
  | "tactics" // Tactic cards are dealing
  | "ui-settle" // UI elements (deck, end turn) are animating in
  | "complete"; // Intro sequence finished, game interactive

/** UI element reveal timing (relative to ui-settle phase start) */
export const UI_REVEAL_TIMING = {
  /** Top bar slides down first - sets the frame */
  topBar: { delay: 0, duration: 400 },
  /** Mana source appears with top bar - player needs to see resources */
  manaSource: { delay: 50, duration: 500 },
  /** Carousel indicator fades in with mana */
  carouselIndicator: { delay: 150, duration: 400 },
  /** End turn seal stamps down after mana settles */
  endTurnSeal: { delay: 300, duration: 450 },
  /** Deck/discard slides in last - lowest priority */
  deckDiscard: { delay: 450, duration: 400 },
  /** The Hold - pause before game becomes interactive (Disney's "the breath") */
  holdDuration: 250,
} as const;

interface GameIntroContextValue {
  /** Current phase of the intro sequence */
  phase: IntroPhase;
  /** Whether the intro sequence has completed (for components that just need to know if they should animate) */
  isIntroComplete: boolean;
  /** Whether we're at mana-source phase or later (mana source should start revealing) */
  shouldRevealManaSource: boolean;
  /** Whether we're past the tactics phase (UI elements should start revealing) */
  shouldRevealUI: boolean;
  /** Start the intro sequence (called when game state first arrives) */
  startIntro: (tileCount: number, enemyCount: number) => void;
  /** Get the stagger delay for a tile based on its index */
  getTileDelay: (index: number) => number;
  /** Get the stagger delay for an enemy based on its index */
  getEnemyDelay: (index: number) => number;
}

const GameIntroContext = createContext<GameIntroContextValue | null>(null);

// Timing constants (in milliseconds) - used for stagger delays only
const TILE_STAGGER_MS = 120; // Delay between each tile
const ENEMY_STAGGER_MS = 80; // Delay between each enemy

// Calculate total UI settle duration (last element delay + its duration + hold)
const UI_SETTLE_TOTAL_MS =
  UI_REVEAL_TIMING.deckDiscard.delay +
  UI_REVEAL_TIMING.deckDiscard.duration +
  UI_REVEAL_TIMING.holdDuration;

export function GameIntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>("idle");
  const hasStarted = useRef(false);
  const { on: onAnimationEvent, emit: emitAnimationEvent } =
    useAnimationDispatcher();

  // Track edge-case listener cleanup function
  const edgeCaseUnsubRef = useRef<(() => void) | null>(null);
  // Track UI settle timeout for cleanup
  const uiSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to animation events to drive phase transitions
  useEffect(() => {
    // When tiles animation completes, transition to enemies phase
    const unsubTiles = onAnimationEvent("tiles-complete", () => {
      setPhase("enemies");
    });

    // When enemies animation completes, transition to hero phase
    const unsubEnemies = onAnimationEvent("enemies-complete", () => {
      setPhase("hero");
    });

    // When hero emerges through portal, transition to mana-source phase
    const unsubHero = onAnimationEvent("hero-complete", () => {
      setPhase("mana-source");
    });

    // When mana source animation completes, transition to tactics phase
    const unsubManaSource = onAnimationEvent("mana-source-complete", () => {
      setPhase("tactics");
    });

    // When tactics animation completes, transition to ui-settle phase
    const unsubTactics = onAnimationEvent("tactics-complete", () => {
      setPhase("ui-settle");
      emitAnimationEvent("ui-settle-start");

      // After UI elements have settled + The Hold, complete the intro
      uiSettleTimeoutRef.current = setTimeout(() => {
        setPhase("complete");
        emitAnimationEvent("intro-complete");
      }, UI_SETTLE_TOTAL_MS);
    });

    return () => {
      unsubTiles();
      unsubEnemies();
      unsubHero();
      unsubManaSource();
      unsubTactics();
      // Clean up any edge-case listener that might still be active
      if (edgeCaseUnsubRef.current) {
        edgeCaseUnsubRef.current();
        edgeCaseUnsubRef.current = null;
      }
      // Clean up UI settle timeout
      if (uiSettleTimeoutRef.current) {
        clearTimeout(uiSettleTimeoutRef.current);
        uiSettleTimeoutRef.current = null;
      }
    };
  }, [onAnimationEvent, emitAnimationEvent]);

  const startIntro = useCallback(
    (tileCount: number, enemyCount: number) => {
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
          // Store in ref for cleanup on unmount
          edgeCaseUnsubRef.current = onAnimationEvent("tiles-complete", () => {
            emitAnimationEvent("enemies-complete");
            if (edgeCaseUnsubRef.current) {
              edgeCaseUnsubRef.current();
              edgeCaseUnsubRef.current = null;
            }
          });
        } else {
          // No tiles AND no enemies - emit enemies-complete immediately
          emitAnimationEvent("enemies-complete");
        }
      }
    },
    [emitAnimationEvent, onAnimationEvent]
  );

  const getTileDelay = useCallback((index: number): number => {
    return index * TILE_STAGGER_MS;
  }, []);

  const getEnemyDelay = useCallback((index: number): number => {
    // Return just the stagger delay for this enemy (relative to when enemies phase starts)
    return index * ENEMY_STAGGER_MS;
  }, []);

  // Mana source should reveal once we're at mana-source phase or later
  const shouldRevealManaSource =
    phase === "mana-source" ||
    phase === "tactics" ||
    phase === "ui-settle" ||
    phase === "complete";

  // UI should start revealing once we're past tactics (during ui-settle or complete)
  const shouldRevealUI = phase === "ui-settle" || phase === "complete";

  const value: GameIntroContextValue = {
    phase,
    isIntroComplete: phase === "complete",
    shouldRevealManaSource,
    shouldRevealUI,
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

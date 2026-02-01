/**
 * Game Lifecycle Events
 *
 * Events for game start, end, and scenario completion.
 *
 * @module events/lifecycle/game
 */

import type { FinalScoreResult } from "../../scoring/index.js";

// ============================================================================
// GAME_STARTED
// ============================================================================

/**
 * Event type constant for game initialization.
 * @see GameStartedEvent
 */
export const GAME_STARTED = "GAME_STARTED" as const;

/**
 * Emitted when a new game is initialized.
 *
 * This is always the first event in any game session. It provides the initial
 * game configuration that clients need to set up their UI.
 *
 * @remarks
 * - Emitted exactly once per game
 * - Precedes all other game events
 * - Triggers: Game initialization via server
 *
 * @example Handling game start
 * ```typescript
 * if (event.type === GAME_STARTED) {
 *   initializeGameUI(event.playerCount, event.scenario);
 * }
 * ```
 */
export interface GameStartedEvent {
  readonly type: typeof GAME_STARTED;
  /** Number of players in this game (1-4) */
  readonly playerCount: number;
  /** Scenario identifier (e.g., "first_reconnaissance", "solo_conquest") */
  readonly scenario: string;
}

/**
 * Creates a GameStartedEvent.
 *
 * @param playerCount - Number of players (1-4)
 * @param scenario - Scenario identifier string
 * @returns A new GameStartedEvent
 *
 * @example
 * const event = createGameStartedEvent(2, "first_reconnaissance");
 */
export function createGameStartedEvent(
  playerCount: number,
  scenario: string
): GameStartedEvent {
  return {
    type: GAME_STARTED,
    playerCount,
    scenario,
  };
}

/**
 * Type guard for GameStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a GameStartedEvent
 */
export function isGameStartedEvent(event: {
  type: string;
}): event is GameStartedEvent {
  return event.type === GAME_STARTED;
}

// ============================================================================
// GAME_ENDED
// ============================================================================

/**
 * Event type constant for game end.
 * @see GameEndedEvent
 */
export const GAME_ENDED = "GAME_ENDED" as const;

/**
 * Emitted when the game concludes.
 *
 * Includes final scoring information for all players.
 *
 * @remarks
 * - This is always the last event in a game
 * - winningPlayerId may be null in case of a tie
 * - Triggers: SCENARIO_END_TRIGGERED conditions met, or all rounds completed
 *
 * @example Showing final scores
 * ```typescript
 * if (event.type === GAME_ENDED) {
 *   showFinalScoreboard(event.finalScores);
 *   highlightWinner(event.winningPlayerId);
 * }
 * ```
 */
export interface GameEndedEvent {
  readonly type: typeof GAME_ENDED;
  /** ID of the winning player, or null for a tie */
  readonly winningPlayerId: string | null;
  /** Final scores for all players, sorted by score descending */
  readonly finalScores: readonly {
    readonly playerId: string;
    readonly score: number;
  }[];
  /** Full scoring breakdown for detailed display (optional for backwards compatibility) */
  readonly fullScoreResult?: FinalScoreResult;
}

/**
 * Creates a GameEndedEvent.
 *
 * @param winningPlayerId - ID of winner, or null for tie
 * @param finalScores - Array of player IDs and their scores
 * @param fullScoreResult - Optional full scoring breakdown
 * @returns A new GameEndedEvent
 */
export function createGameEndedEvent(
  winningPlayerId: string | null,
  finalScores: readonly { readonly playerId: string; readonly score: number }[],
  fullScoreResult?: FinalScoreResult
): GameEndedEvent {
  const event: GameEndedEvent = {
    type: GAME_ENDED,
    winningPlayerId,
    finalScores,
  };

  if (fullScoreResult !== undefined) {
    return { ...event, fullScoreResult };
  }

  return event;
}

/**
 * Type guard for GameEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a GameEndedEvent
 */
export function isGameEndedEvent(event: {
  type: string;
}): event is GameEndedEvent {
  return event.type === GAME_ENDED;
}

// ============================================================================
// SCENARIO_END_TRIGGERED
// ============================================================================

/**
 * Event type constant for scenario end trigger.
 * @see ScenarioEndTriggeredEvent
 */
export const SCENARIO_END_TRIGGERED = "SCENARIO_END_TRIGGERED" as const;

/**
 * Emitted when a scenario victory/end condition is triggered.
 *
 * Different scenarios have different end conditions (e.g., conquering cities,
 * defeating bosses, etc.).
 *
 * @remarks
 * - The game may continue for remaining players after this
 * - Multiple players may trigger end conditions
 * - Precedes GAME_ENDED
 *
 * @example
 * ```typescript
 * if (event.type === SCENARIO_END_TRIGGERED) {
 *   showVictoryAnimation(event.playerId, event.trigger);
 * }
 * ```
 */
export interface ScenarioEndTriggeredEvent {
  readonly type: typeof SCENARIO_END_TRIGGERED;
  /** ID of the player who triggered the end condition */
  readonly playerId: string;
  /** Description of what triggered the end (e.g., "conquered_city") */
  readonly trigger: string;
}

/**
 * Creates a ScenarioEndTriggeredEvent.
 *
 * @param playerId - ID of player who triggered the condition
 * @param trigger - Description of the trigger
 * @returns A new ScenarioEndTriggeredEvent
 */
export function createScenarioEndTriggeredEvent(
  playerId: string,
  trigger: string
): ScenarioEndTriggeredEvent {
  return {
    type: SCENARIO_END_TRIGGERED,
    playerId,
    trigger,
  };
}

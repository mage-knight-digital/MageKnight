/**
 * Tactic Selection Events
 *
 * Events for the tactics selection phase at the start of each round.
 *
 * @module events/tactics/selection
 */

import type { TacticId } from "../../tactics.js";

// ============================================================================
// TACTIC_SELECTED
// ============================================================================

/**
 * Event type constant for tactic selection.
 * @see TacticSelectedEvent
 */
export const TACTIC_SELECTED = "TACTIC_SELECTED" as const;

/**
 * Emitted when a player selects their tactic for the round.
 *
 * Tactics determine turn order and provide special abilities.
 * Lower turn order numbers go first.
 *
 * @remarks
 * - Each player must select one tactic per round
 * - Tactics are revealed simultaneously in multiplayer
 * - Turn order conflicts resolved by proximity to first player position
 * - Triggers: SELECT_TACTIC_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === TACTIC_SELECTED) {
 *   updatePlayerTactic(event.playerId, event.tacticId);
 *   displayTurnOrderPreview(event.turnOrder);
 * }
 * ```
 */
export interface TacticSelectedEvent {
  readonly type: typeof TACTIC_SELECTED;
  /** ID of the player who selected the tactic */
  readonly playerId: string;
  /** ID of the selected tactic */
  readonly tacticId: TacticId;
  /** Player's position in turn order (1 = first) */
  readonly turnOrder: number;
}

/**
 * Creates a TacticSelectedEvent.
 *
 * @param playerId - ID of the player
 * @param tacticId - ID of the selected tactic
 * @param turnOrder - Position in turn order
 * @returns A new TacticSelectedEvent
 */
export function createTacticSelectedEvent(
  playerId: string,
  tacticId: TacticId,
  turnOrder: number
): TacticSelectedEvent {
  return {
    type: TACTIC_SELECTED,
    playerId,
    tacticId,
    turnOrder,
  };
}

/**
 * Type guard for TacticSelectedEvent.
 */
export function isTacticSelectedEvent(event: {
  type: string;
}): event is TacticSelectedEvent {
  return event.type === TACTIC_SELECTED;
}

// ============================================================================
// DUMMY_TACTIC_SELECTED
// ============================================================================

/**
 * Event type constant for dummy tactic selection (solo games).
 * @see DummyTacticSelectedEvent
 */
export const DUMMY_TACTIC_SELECTED = "DUMMY_TACTIC_SELECTED" as const;

/**
 * Emitted when the dummy player selects a tactic in solo games.
 *
 * The dummy player is an abstract opponent that affects turn order
 * and mana availability in solo scenarios.
 *
 * @remarks
 * - Only appears in solo game mode
 * - Dummy player's tactic affects available tactics for next round
 * - No playerId since it's not a real player
 *
 * @example
 * ```typescript
 * if (event.type === DUMMY_TACTIC_SELECTED) {
 *   markTacticAsUsedByDummy(event.tacticId);
 * }
 * ```
 */
export interface DummyTacticSelectedEvent {
  readonly type: typeof DUMMY_TACTIC_SELECTED;
  /** ID of the tactic selected by the dummy player */
  readonly tacticId: TacticId;
  /** Dummy's position in turn order */
  readonly turnOrder: number;
}

/**
 * Creates a DummyTacticSelectedEvent.
 *
 * @param tacticId - ID of the tactic
 * @param turnOrder - Position in turn order
 * @returns A new DummyTacticSelectedEvent
 */
export function createDummyTacticSelectedEvent(
  tacticId: TacticId,
  turnOrder: number
): DummyTacticSelectedEvent {
  return {
    type: DUMMY_TACTIC_SELECTED,
    tacticId,
    turnOrder,
  };
}

// ============================================================================
// TACTICS_PHASE_ENDED
// ============================================================================

/**
 * Event type constant for tactics phase completion.
 * @see TacticsPhaseEndedEvent
 */
export const TACTICS_PHASE_ENDED = "TACTICS_PHASE_ENDED" as const;

/**
 * Emitted when all players have selected their tactics.
 *
 * Contains the final turn order for the round.
 *
 * @remarks
 * - All tactics are now revealed
 * - Turn order is finalized and cannot change
 * - First player's turn begins after this
 *
 * @example
 * ```typescript
 * if (event.type === TACTICS_PHASE_ENDED) {
 *   displayFinalTurnOrder(event.turnOrder);
 *   highlightFirstPlayer(event.turnOrder[0]);
 * }
 * ```
 */
export interface TacticsPhaseEndedEvent {
  readonly type: typeof TACTICS_PHASE_ENDED;
  /** Final turn order as array of player IDs */
  readonly turnOrder: readonly string[];
}

/**
 * Creates a TacticsPhaseEndedEvent.
 *
 * @param turnOrder - Array of player IDs in turn order
 * @returns A new TacticsPhaseEndedEvent
 */
export function createTacticsPhaseEndedEvent(
  turnOrder: readonly string[]
): TacticsPhaseEndedEvent {
  return {
    type: TACTICS_PHASE_ENDED,
    turnOrder,
  };
}

/**
 * Type guard for TacticsPhaseEndedEvent.
 */
export function isTacticsPhaseEndedEvent(event: {
  type: string;
}): event is TacticsPhaseEndedEvent {
  return event.type === TACTICS_PHASE_ENDED;
}

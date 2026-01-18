/**
 * Tactic Activation Events
 *
 * Events for tactic abilities and decisions during gameplay.
 *
 * @module events/tactics/activation
 */

import type { TacticId } from "../../tactics.js";
import type { TacticDecisionType } from "../../valueConstants.js";

// ============================================================================
// TACTIC_ACTIVATED
// ============================================================================

/**
 * Event type constant for tactic activation.
 * @see TacticActivatedEvent
 */
export const TACTIC_ACTIVATED = "TACTIC_ACTIVATED" as const;

/**
 * Emitted when a player's tactic ability is activated.
 *
 * Some tactics have effects that trigger at the start of the player's turn
 * or when certain conditions are met.
 *
 * @remarks
 * - Typically occurs at the start of the player's turn
 * - Effect depends on the specific tactic
 * - May be followed by TACTIC_DECISION_RESOLVED if choice required
 *
 * @example
 * ```typescript
 * if (event.type === TACTIC_ACTIVATED) {
 *   showTacticEffect(event.tacticId);
 *   highlightActivePlayer(event.playerId);
 * }
 * ```
 */
export interface TacticActivatedEvent {
  readonly type: typeof TACTIC_ACTIVATED;
  /** ID of the player whose tactic activated */
  readonly playerId: string;
  /** ID of the activated tactic */
  readonly tacticId: TacticId;
}

/**
 * Creates a TacticActivatedEvent.
 *
 * @param playerId - ID of the player
 * @param tacticId - ID of the tactic
 * @returns A new TacticActivatedEvent
 */
export function createTacticActivatedEvent(
  playerId: string,
  tacticId: TacticId
): TacticActivatedEvent {
  return {
    type: TACTIC_ACTIVATED,
    playerId,
    tacticId,
  };
}

// ============================================================================
// TACTIC_DECISION_RESOLVED
// ============================================================================

/**
 * Event type constant for tactic decision resolution.
 * @see TacticDecisionResolvedEvent
 */
export const TACTIC_DECISION_RESOLVED = "TACTIC_DECISION_RESOLVED" as const;

/**
 * Emitted when a player resolves a pending tactic decision.
 *
 * Some tactics require the player to make a choice (e.g., which die to reroll).
 *
 * @remarks
 * - Follows TACTIC_ACTIVATED for tactics requiring decisions
 * - Decision type varies by tactic
 * - Triggers: Player action resolving the pending choice
 *
 * @example
 * ```typescript
 * if (event.type === TACTIC_DECISION_RESOLVED) {
 *   hideTacticChoiceUI();
 *   applyTacticChoice(event.decisionType);
 * }
 * ```
 */
export interface TacticDecisionResolvedEvent {
  readonly type: typeof TACTIC_DECISION_RESOLVED;
  /** ID of the player who made the decision */
  readonly playerId: string;
  /** Type of decision that was resolved */
  readonly decisionType: TacticDecisionType;
}

/**
 * Creates a TacticDecisionResolvedEvent.
 *
 * @param playerId - ID of the player
 * @param decisionType - Type of decision resolved
 * @returns A new TacticDecisionResolvedEvent
 */
export function createTacticDecisionResolvedEvent(
  playerId: string,
  decisionType: TacticDecisionType
): TacticDecisionResolvedEvent {
  return {
    type: TACTIC_DECISION_RESOLVED,
    playerId,
    decisionType,
  };
}

// ============================================================================
// SOURCE_DICE_REROLLED
// ============================================================================

/**
 * Event type constant for mana source dice reroll.
 * @see SourceDiceRerolledEvent
 */
export const SOURCE_DICE_REROLLED = "SOURCE_DICE_REROLLED" as const;

/**
 * Emitted when a player rerolls dice in the mana source.
 *
 * Certain tactics allow rerolling some or all source dice.
 *
 * @remarks
 * - Typically from Mana Draw tactic
 * - dieIds indicates which dice were rerolled
 * - New colors determined by RNG
 *
 * @example
 * ```typescript
 * if (event.type === SOURCE_DICE_REROLLED) {
 *   animateDiceReroll(event.dieIds);
 * }
 * ```
 */
export interface SourceDiceRerolledEvent {
  readonly type: typeof SOURCE_DICE_REROLLED;
  /** ID of the player who caused the reroll */
  readonly playerId: string;
  /** IDs of the dice that were rerolled */
  readonly dieIds: readonly string[];
}

/**
 * Creates a SourceDiceRerolledEvent.
 *
 * @param playerId - ID of the player
 * @param dieIds - IDs of rerolled dice
 * @returns A new SourceDiceRerolledEvent
 */
export function createSourceDiceRerolledEvent(
  playerId: string,
  dieIds: readonly string[]
): SourceDiceRerolledEvent {
  return {
    type: SOURCE_DICE_REROLLED,
    playerId,
    dieIds,
  };
}

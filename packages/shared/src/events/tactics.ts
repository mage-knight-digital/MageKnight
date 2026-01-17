/**
 * Tactics Events
 *
 * Events related to the tactics selection phase at the start of each round,
 * as well as tactic activation effects during gameplay.
 *
 * @module events/tactics
 *
 * @example Tactics Phase Flow
 * ```
 * ROUND_STARTED
 *   └─► (each player selects a tactic)
 *         ├─► TACTIC_SELECTED (player 0)
 *         ├─► TACTIC_SELECTED (player 1)
 *         └─► DUMMY_TACTIC_SELECTED (solo game only)
 *   └─► TACTICS_PHASE_ENDED (final turn order determined)
 *   └─► TURN_STARTED (first player from turn order)
 *         └─► TACTIC_ACTIVATED (if tactic has start-of-turn effect)
 *         └─► TACTIC_DECISION_RESOLVED (if tactic required choice)
 * ```
 */

import type { TacticId } from "../tactics.js";
import type { RestType } from "../actions.js";
import type { TacticDecisionType } from "../valueConstants.js";

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

// ============================================================================
// DECKS_RESHUFFLED
// ============================================================================

/**
 * Event type constant for deck reshuffle.
 * @see DecksReshuffledEvent
 */
export const DECKS_RESHUFFLED = "DECKS_RESHUFFLED" as const;

/**
 * Emitted when a player's discard pile is shuffled back into their deck.
 *
 * This typically happens during rest when the deck is empty.
 *
 * @remarks
 * - All cards from discard pile go back to deck
 * - Deck is shuffled (RNG operation)
 * - May occur during rest or when drawing from empty deck
 *
 * @example
 * ```typescript
 * if (event.type === DECKS_RESHUFFLED) {
 *   animateDeckShuffle(event.playerId);
 *   updateDeckCount(event.playerId, event.cardsInDeck);
 * }
 * ```
 */
export interface DecksReshuffledEvent {
  readonly type: typeof DECKS_RESHUFFLED;
  /** ID of the player whose deck was reshuffled */
  readonly playerId: string;
  /** Number of cards now in the deck */
  readonly cardsInDeck: number;
}

/**
 * Creates a DecksReshuffledEvent.
 *
 * @param playerId - ID of the player
 * @param cardsInDeck - Number of cards after reshuffle
 * @returns A new DecksReshuffledEvent
 */
export function createDecksReshuffledEvent(
  playerId: string,
  cardsInDeck: number
): DecksReshuffledEvent {
  return {
    type: DECKS_RESHUFFLED,
    playerId,
    cardsInDeck,
  };
}

// ============================================================================
// PLAYER_RESTED
// ============================================================================

/**
 * Event type constant for player rest action.
 * @see PlayerRestedEvent
 */
export const PLAYER_RESTED = "PLAYER_RESTED" as const;

/**
 * Emitted when a player takes a rest action.
 *
 * Resting allows discarding cards and wounds, typically ending the turn.
 *
 * @remarks
 * - Rest types: "regular" (discard non-wound), "slow_recovery" (discard all)
 * - Wounds go to discard pile, NOT healed
 * - If announcedEndOfRound is true, round ends after remaining players
 * - Triggers: REST_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_RESTED) {
 *   showRestAnimation(event.playerId, event.restType);
 *   if (event.announcedEndOfRound) {
 *     showEndOfRoundWarning();
 *   }
 * }
 * ```
 */
export interface PlayerRestedEvent {
  readonly type: typeof PLAYER_RESTED;
  /** ID of the player who rested */
  readonly playerId: string;
  /** Type of rest taken */
  readonly restType: RestType;
  /** Number of cards discarded */
  readonly cardsDiscarded: number;
  /** Number of wounds moved to discard (not healed) */
  readonly woundsDiscarded: number;
  /** True if this rest announced end of round */
  readonly announcedEndOfRound: boolean;
}

/**
 * Creates a PlayerRestedEvent.
 *
 * @param playerId - ID of the player
 * @param restType - Type of rest
 * @param cardsDiscarded - Cards discarded
 * @param woundsDiscarded - Wounds moved to discard
 * @param announcedEndOfRound - Whether end of round was announced
 * @returns A new PlayerRestedEvent
 */
export function createPlayerRestedEvent(
  playerId: string,
  restType: RestType,
  cardsDiscarded: number,
  woundsDiscarded: number,
  announcedEndOfRound: boolean
): PlayerRestedEvent {
  return {
    type: PLAYER_RESTED,
    playerId,
    restType,
    cardsDiscarded,
    woundsDiscarded,
    announcedEndOfRound,
  };
}

// ============================================================================
// REST_UNDONE
// ============================================================================

/**
 * Event type constant for rest undo.
 * @see RestUndoneEvent
 */
export const REST_UNDONE = "REST_UNDONE" as const;

/**
 * Emitted when a rest action is undone.
 *
 * Player's cards are restored to their pre-rest state.
 *
 * @remarks
 * - Only possible before any irreversible action
 * - Restores cards to hand from discard
 * - Triggers: UNDO_ACTION after REST_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === REST_UNDONE) {
 *   restoreHandFromDiscard(event.playerId);
 * }
 * ```
 */
export interface RestUndoneEvent {
  readonly type: typeof REST_UNDONE;
  /** ID of the player whose rest was undone */
  readonly playerId: string;
}

/**
 * Creates a RestUndoneEvent.
 *
 * @param playerId - ID of the player
 * @returns A new RestUndoneEvent
 */
export function createRestUndoneEvent(playerId: string): RestUndoneEvent {
  return {
    type: REST_UNDONE,
    playerId,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for TacticSelectedEvent.
 */
export function isTacticSelectedEvent(event: {
  type: string;
}): event is TacticSelectedEvent {
  return event.type === TACTIC_SELECTED;
}

/**
 * Type guard for TacticsPhaseEndedEvent.
 */
export function isTacticsPhaseEndedEvent(event: {
  type: string;
}): event is TacticsPhaseEndedEvent {
  return event.type === TACTICS_PHASE_ENDED;
}

/**
 * Type guard for PlayerRestedEvent.
 */
export function isPlayerRestedEvent(event: {
  type: string;
}): event is PlayerRestedEvent {
  return event.type === PLAYER_RESTED;
}

/**
 * Check if an event is any tactics-related event.
 */
export function isTacticsEvent(event: { type: string }): boolean {
  return [
    TACTIC_SELECTED,
    DUMMY_TACTIC_SELECTED,
    TACTICS_PHASE_ENDED,
    TACTIC_ACTIVATED,
    TACTIC_DECISION_RESOLVED,
    SOURCE_DICE_REROLLED,
    DECKS_RESHUFFLED,
    PLAYER_RESTED,
    REST_UNDONE,
  ].includes(event.type as typeof TACTIC_SELECTED);
}

/**
 * Rest Events
 *
 * Events for resting and deck reshuffling.
 *
 * @module events/tactics/rest
 */

import type { RestType } from "../../actions.js";

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

/**
 * Type guard for PlayerRestedEvent.
 */
export function isPlayerRestedEvent(event: {
  type: string;
}): event is PlayerRestedEvent {
  return event.type === PLAYER_RESTED;
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
// REST_DECLARED
// ============================================================================

/**
 * Event type constant for rest declaration.
 * @see RestDeclaredEvent
 */
export const REST_DECLARED = "REST_DECLARED" as const;

/**
 * Emitted when a player declares they are resting.
 *
 * Per FAQ p.30: "When you Rest, you don't declare which kind of Rest you're doing
 * (Standard Rest or Slow Recovery): you merely announce that you're Resting."
 *
 * While resting:
 * - Movement is blocked
 * - Combat initiation is blocked
 * - Interaction is blocked
 * - Card play is still allowed (healing, special effects, influence for AAs)
 *
 * @remarks
 * - Player enters isResting state
 * - Can still play cards before completing rest
 * - Must complete rest with COMPLETE_REST action before ending turn
 * - Triggers: DECLARE_REST_ACTION
 */
export interface RestDeclaredEvent {
  readonly type: typeof REST_DECLARED;
  /** ID of the player who declared rest */
  readonly playerId: string;
}

/**
 * Creates a RestDeclaredEvent.
 *
 * @param playerId - ID of the player
 * @returns A new RestDeclaredEvent
 */
export function createRestDeclaredEvent(playerId: string): RestDeclaredEvent {
  return {
    type: REST_DECLARED,
    playerId,
  };
}

/**
 * Type guard for RestDeclaredEvent.
 */
export function isRestDeclaredEvent(event: {
  type: string;
}): event is RestDeclaredEvent {
  return event.type === REST_DECLARED;
}

// ============================================================================
// REST_DECLARE_UNDONE
// ============================================================================

/**
 * Event type constant for rest declaration undo.
 * @see RestDeclareUndoneEvent
 */
export const REST_DECLARE_UNDONE = "REST_DECLARE_UNDONE" as const;

/**
 * Emitted when a rest declaration is undone.
 *
 * Player exits resting state and can take regular actions again.
 *
 * @remarks
 * - Restores isResting to false
 * - Player can now move, fight, interact again
 * - Triggers: UNDO_ACTION after DECLARE_REST_ACTION
 */
export interface RestDeclareUndoneEvent {
  readonly type: typeof REST_DECLARE_UNDONE;
  /** ID of the player whose rest declaration was undone */
  readonly playerId: string;
}

/**
 * Creates a RestDeclareUndoneEvent.
 *
 * @param playerId - ID of the player
 * @returns A new RestDeclareUndoneEvent
 */
export function createRestDeclareUndoneEvent(
  playerId: string
): RestDeclareUndoneEvent {
  return {
    type: REST_DECLARE_UNDONE,
    playerId,
  };
}

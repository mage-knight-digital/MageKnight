/**
 * Card Events
 *
 * Events related to card play, drawing, discarding, and gaining new cards.
 * Cards are the primary mechanism for taking actions in the game.
 *
 * @module events/cards
 *
 * @example Card Play Flow
 * ```
 * CARD_PLAYED (card enters play area)
 *   └─► Effect resolves
 *         └─► May trigger CHOICE_REQUIRED if effect has options
 *         └─► May trigger other events based on effect
 *
 * Turn End:
 *   └─► CARD_DISCARDED (for each card in play area)
 *   └─► CARD_DRAWN (up to hand limit)
 *
 * Gaining Cards:
 *   └─► CARD_GAINED (from offer, level up, or reward)
 * ```
 */

import type { CardId } from "../ids.js";
import {
  CARD_GAIN_SOURCE_LEVEL_UP,
  CARD_GAIN_SOURCE_OFFER,
  CARD_GAIN_SOURCE_REWARD,
} from "../valueConstants.js";

// ============================================================================
// CARD_PLAYED
// ============================================================================

/**
 * Event type constant for card play.
 * @see CardPlayedEvent
 */
export const CARD_PLAYED = "CARD_PLAYED" as const;

/**
 * Emitted when a player plays a card from their hand.
 *
 * Cards can be played normally, powered (with mana), or sideways (for basic effect).
 *
 * @remarks
 * - powered: true means mana was spent to enhance the effect
 * - sideways: true means card was played for basic Move 1 / Attack 1 / etc.
 * - effect: human-readable description of what the card does
 * - Card moves from hand to play area
 * - Can be undone before irreversible action
 * - Triggers: PLAY_CARD_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === CARD_PLAYED) {
 *   moveCardToPlayArea(event.playerId, event.cardId);
 *   if (event.powered) {
 *     showPoweredEffect(event.effect);
 *   }
 * }
 * ```
 */
export interface CardPlayedEvent {
  readonly type: typeof CARD_PLAYED;
  /** ID of the player who played the card */
  readonly playerId: string;
  /** ID of the card played */
  readonly cardId: CardId;
  /** True if the card was powered with mana */
  readonly powered: boolean;
  /** True if played sideways for basic effect */
  readonly sideways: boolean;
  /** Human-readable description of the effect */
  readonly effect: string;
}

/**
 * Creates a CardPlayedEvent.
 *
 * @param playerId - ID of the player
 * @param cardId - ID of the played card
 * @param powered - Whether card was powered
 * @param sideways - Whether played sideways
 * @param effect - Effect description
 * @returns A new CardPlayedEvent
 */
export function createCardPlayedEvent(
  playerId: string,
  cardId: CardId,
  powered: boolean,
  sideways: boolean,
  effect: string
): CardPlayedEvent {
  return {
    type: CARD_PLAYED,
    playerId,
    cardId,
    powered,
    sideways,
    effect,
  };
}

// ============================================================================
// CARD_DRAWN
// ============================================================================

/**
 * Event type constant for card draw.
 * @see CardDrawnEvent
 */
export const CARD_DRAWN = "CARD_DRAWN" as const;

/**
 * Emitted when a player draws cards.
 *
 * Cards are drawn at end of turn up to hand limit, or from effects.
 *
 * @remarks
 * - count is the number of cards drawn
 * - If deck is empty, discard is shuffled first (see DECKS_RESHUFFLED)
 * - Hand limit is typically 5 (can be modified)
 *
 * @example
 * ```typescript
 * if (event.type === CARD_DRAWN) {
 *   animateCardDraw(event.playerId, event.count);
 *   updateHandDisplay(event.playerId);
 * }
 * ```
 */
export interface CardDrawnEvent {
  readonly type: typeof CARD_DRAWN;
  /** ID of the player who drew cards */
  readonly playerId: string;
  /** Number of cards drawn */
  readonly count: number;
}

/**
 * Creates a CardDrawnEvent.
 *
 * @param playerId - ID of the player
 * @param count - Number of cards drawn
 * @returns A new CardDrawnEvent
 */
export function createCardDrawnEvent(
  playerId: string,
  count: number
): CardDrawnEvent {
  return {
    type: CARD_DRAWN,
    playerId,
    count,
  };
}

// ============================================================================
// CARD_DISCARDED
// ============================================================================

/**
 * Event type constant for card discard.
 * @see CardDiscardedEvent
 */
export const CARD_DISCARDED = "CARD_DISCARDED" as const;

/**
 * Emitted when a card is discarded.
 *
 * Cards are discarded at end of turn or from effects.
 *
 * @remarks
 * - Card moves from hand/play area to discard pile
 * - Discarded cards are reshuffled when deck is empty
 *
 * @example
 * ```typescript
 * if (event.type === CARD_DISCARDED) {
 *   animateCardToDiscard(event.playerId, event.cardId);
 * }
 * ```
 */
export interface CardDiscardedEvent {
  readonly type: typeof CARD_DISCARDED;
  /** ID of the player who discarded */
  readonly playerId: string;
  /** ID of the discarded card */
  readonly cardId: CardId;
}

/**
 * Creates a CardDiscardedEvent.
 *
 * @param playerId - ID of the player
 * @param cardId - ID of the discarded card
 * @returns A new CardDiscardedEvent
 */
export function createCardDiscardedEvent(
  playerId: string,
  cardId: CardId
): CardDiscardedEvent {
  return {
    type: CARD_DISCARDED,
    playerId,
    cardId,
  };
}

// ============================================================================
// CARD_GAINED
// ============================================================================

/**
 * Event type constant for card gain.
 * @see CardGainedEvent
 */
export const CARD_GAINED = "CARD_GAINED" as const;

/**
 * Emitted when a player gains a new card.
 *
 * Cards can be gained from offers (market), level up rewards, or conquest rewards.
 *
 * @remarks
 * - source indicates where the card came from
 * - Gained cards typically go to top of deed deck
 * - Triggers: SELECT_OFFER_CARD_ACTION, SELECT_REWARD_ACTION, level up resolution
 *
 * @example
 * ```typescript
 * if (event.type === CARD_GAINED) {
 *   addCardToDeck(event.playerId, event.cardId);
 *   showNewCardNotification(event.cardId, event.source);
 * }
 * ```
 */
export interface CardGainedEvent {
  readonly type: typeof CARD_GAINED;
  /** ID of the player who gained the card */
  readonly playerId: string;
  /** ID of the gained card */
  readonly cardId: CardId;
  /** Source of the card */
  readonly source:
    | typeof CARD_GAIN_SOURCE_OFFER
    | typeof CARD_GAIN_SOURCE_REWARD
    | typeof CARD_GAIN_SOURCE_LEVEL_UP;
}

/**
 * Creates a CardGainedEvent.
 *
 * @param playerId - ID of the player
 * @param cardId - ID of the gained card
 * @param source - Where the card came from
 * @returns A new CardGainedEvent
 */
export function createCardGainedEvent(
  playerId: string,
  cardId: CardId,
  source: CardGainedEvent["source"]
): CardGainedEvent {
  return {
    type: CARD_GAINED,
    playerId,
    cardId,
    source,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CardPlayedEvent.
 */
export function isCardPlayedEvent(event: {
  type: string;
}): event is CardPlayedEvent {
  return event.type === CARD_PLAYED;
}

/**
 * Type guard for CardDrawnEvent.
 */
export function isCardDrawnEvent(event: {
  type: string;
}): event is CardDrawnEvent {
  return event.type === CARD_DRAWN;
}

/**
 * Type guard for CardDiscardedEvent.
 */
export function isCardDiscardedEvent(event: {
  type: string;
}): event is CardDiscardedEvent {
  return event.type === CARD_DISCARDED;
}

/**
 * Type guard for CardGainedEvent.
 */
export function isCardGainedEvent(event: {
  type: string;
}): event is CardGainedEvent {
  return event.type === CARD_GAINED;
}

/**
 * Check if an event is any card-related event.
 */
export function isCardEvent(event: { type: string }): boolean {
  return [CARD_PLAYED, CARD_DRAWN, CARD_DISCARDED, CARD_GAINED].includes(
    event.type as typeof CARD_PLAYED
  );
}

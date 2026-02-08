/**
 * Dummy Player Events
 *
 * Events for the solo-mode dummy player: creation, turn execution,
 * end-of-round announcement, and card/crystal acquisition.
 *
 * @module events/dummyPlayer
 */

import type { HeroId } from "../hero.js";
import type { CardId, BasicManaColor } from "../ids.js";

// ============================================================================
// DUMMY_PLAYER_CREATED
// ============================================================================

export const DUMMY_PLAYER_CREATED = "DUMMY_PLAYER_CREATED" as const;

/**
 * Emitted during game setup when a dummy player is created for solo mode.
 */
export interface DummyPlayerCreatedEvent {
  readonly type: typeof DUMMY_PLAYER_CREATED;
  readonly heroId: HeroId;
}

// ============================================================================
// DUMMY_TURN_EXECUTED
// ============================================================================

export const DUMMY_TURN_EXECUTED = "DUMMY_TURN_EXECUTED" as const;

/**
 * Emitted each time the dummy player takes a turn (flips cards from deck).
 */
export interface DummyTurnExecutedEvent {
  readonly type: typeof DUMMY_TURN_EXECUTED;
  readonly cardsFlipped: number;
  readonly bonusFlipped: number;
  readonly matchedColor: BasicManaColor | null;
  readonly deckRemaining: number;
}

// ============================================================================
// DUMMY_END_OF_ROUND_ANNOUNCED
// ============================================================================

export const DUMMY_END_OF_ROUND_ANNOUNCED = "DUMMY_END_OF_ROUND_ANNOUNCED" as const;

/**
 * Emitted when the dummy player's deck is exhausted, announcing end of round.
 */
export interface DummyEndOfRoundAnnouncedEvent {
  readonly type: typeof DUMMY_END_OF_ROUND_ANNOUNCED;
}

// ============================================================================
// DUMMY_GAINED_CARD
// ============================================================================

export const DUMMY_GAINED_CARD = "DUMMY_GAINED_CARD" as const;

/**
 * Emitted when the dummy player gains an advanced action from the offer
 * at end of round.
 */
export interface DummyGainedCardEvent {
  readonly type: typeof DUMMY_GAINED_CARD;
  readonly cardId: CardId;
}

// ============================================================================
// DUMMY_GAINED_CRYSTAL
// ============================================================================

export const DUMMY_GAINED_CRYSTAL = "DUMMY_GAINED_CRYSTAL" as const;

/**
 * Emitted when the dummy player gains a crystal from a spell being removed
 * from the offer at end of round.
 */
export interface DummyGainedCrystalEvent {
  readonly type: typeof DUMMY_GAINED_CRYSTAL;
  readonly color: BasicManaColor;
}

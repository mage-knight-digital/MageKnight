/**
 * Dummy Player types for solo mode
 *
 * The dummy player is a non-interactive opponent that takes turns by flipping
 * cards from its deck. It serves to pace the game and provide turn-order
 * competition in solo play.
 */

import type { CardId, BasicManaColor, HeroId } from "@mage-knight/shared";

/** Sentinel ID for the dummy player — never a real player */
export const DUMMY_PLAYER_ID = "__dummy__" as const;

/** Check whether an ID refers to the dummy player */
export function isDummyPlayer(id: string): boolean {
  return id === DUMMY_PLAYER_ID;
}

/**
 * One pre-computed dummy turn.
 * After the deck is shuffled at round start, all turns for the round are
 * deterministic and can be pre-calculated.
 */
export interface PrecomputedDummyTurn {
  /** Number of base cards flipped (always 3 unless deck is short) */
  readonly cardsFlipped: number;
  /** Extra cards flipped due to crystal color match */
  readonly bonusFlipped: number;
  /** The basic mana color that matched a crystal, or null */
  readonly matchedColor: BasicManaColor | null;
  /** Cards remaining in deck after this turn */
  readonly deckRemainingAfter: number;
}

/**
 * Full dummy player state stored on GameState.
 * Contains the real deck/crystal data (hidden from clients).
 */
export interface DummyPlayer {
  readonly heroId: HeroId;
  readonly deck: readonly CardId[];
  readonly discard: readonly CardId[];
  readonly crystals: Readonly<Record<BasicManaColor, number>>;
  readonly precomputedTurns: readonly PrecomputedDummyTurn[];
  readonly currentTurnIndex: number;
}

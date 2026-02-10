/**
 * Shared knockout rules.
 *
 * These pure helpers are used by combat commands and effect handlers so
 * knockout behavior stays consistent regardless of wound source.
 */

import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Knockout triggers when wounds taken during a single combat reach/exceed
 * the hero's unmodified hand limit (printed on level token).
 */
export function isKnockoutTriggered(
  woundsThisCombat: number,
  unmodifiedHandLimit: number
): boolean {
  return woundsThisCombat >= unmodifiedHandLimit;
}

/**
 * On knockout, immediately discard all non-wound cards from hand.
 */
export function discardNonWoundsFromHand(
  hand: readonly CardId[],
  discard: readonly CardId[]
): {
  hand: readonly CardId[];
  discard: readonly CardId[];
} {
  const woundsInHand = hand.filter((cardId) => cardId === CARD_WOUND);
  const nonWoundsInHand = hand.filter((cardId) => cardId !== CARD_WOUND);

  return {
    hand: woundsInHand,
    discard: [...discard, ...nonWoundsInHand],
  };
}

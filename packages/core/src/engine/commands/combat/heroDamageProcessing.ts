/**
 * Hero damage processing for damage assignment
 *
 * Handles wounds applied to the hero, including:
 * - Poison effects (matching wounds go to discard)
 * - Paralyze effects (discard all non-wound cards from hand)
 * - Knockout threshold (wounds this combat >= hand limit)
 */

import type { Player } from "../../../types/player.js";
import type { CardId, GameEvent } from "@mage-knight/shared";
import {
  CARD_WOUND,
  PLAYER_KNOCKED_OUT,
  PARALYZE_HAND_DISCARDED,
} from "@mage-knight/shared";

/**
 * Result of processing hero wounds.
 */
export interface HeroWoundResult {
  /** Updated player state */
  player: Player;
  /** Events generated from wounds */
  events: GameEvent[];
  /** Total wounds added to hand */
  woundsToHand: number;
}

/**
 * Apply wounds to the hero.
 * Handles poison (extra wounds to discard), paralyze (discard hand), and knockout.
 *
 * @param player - Current player state
 * @param heroWounds - Number of wounds to apply
 * @param playerId - Player ID for events
 * @param isPoisoned - Whether poison ability is active
 * @param isParalyzed - Whether paralyze ability is active
 * @param currentWoundsThisCombat - Wounds already taken this combat (for knockout tracking)
 */
export function applyHeroWounds(
  player: Player,
  heroWounds: number,
  playerId: string,
  isPoisoned: boolean,
  isParalyzed: boolean,
  currentWoundsThisCombat: number
): HeroWoundResult {
  if (heroWounds <= 0) {
    return {
      player,
      events: [],
      woundsToHand: 0,
    };
  }

  // Veil of Mist: hero ignores first wound from enemies this turn
  // When active, ignore all wounds from THIS damage assignment and clear the immunity
  // This also ignores Poison/Paralyze effects since the wound is fully ignored
  if (player.woundImmunityActive) {
    return {
      player: { ...player, woundImmunityActive: false },
      events: [],
      woundsToHand: 0,
    };
  }

  const events: GameEvent[] = [];

  // Poison (hero): wounds go to hand AND matching wounds go to discard
  const woundsToHand: CardId[] = Array(heroWounds).fill(CARD_WOUND);
  const woundsToDiscard: CardId[] = isPoisoned
    ? Array(heroWounds).fill(CARD_WOUND)
    : [];

  let newHand: CardId[] = [...player.hand, ...woundsToHand];
  let newDiscard: CardId[] = [...player.discard, ...woundsToDiscard];

  // Paralyze (hero): discard all non-wound cards from hand when wounds are taken
  if (isParalyzed) {
    const nonWoundsInHand = newHand.filter((cardId) => cardId !== CARD_WOUND);
    const woundsInHand = newHand.filter((cardId) => cardId === CARD_WOUND);

    if (nonWoundsInHand.length > 0) {
      newHand = woundsInHand;
      newDiscard = [...newDiscard, ...nonWoundsInHand];
      events.push({
        type: PARALYZE_HAND_DISCARDED,
        playerId,
        cardsDiscarded: nonWoundsInHand.length,
      });
    }
  }

  // Only wounds to HAND count for knockout tracking
  // Poison wounds to discard are extra punishment but don't count toward knockout threshold
  const totalWoundsThisCombat = currentWoundsThisCombat + heroWounds;

  // Check for knockout (wounds this combat >= hand limit)
  const isKnockedOut = totalWoundsThisCombat >= player.handLimit;

  let finalHand: readonly CardId[] = newHand;
  let finalDiscard: readonly CardId[] = newDiscard;
  if (isKnockedOut) {
    // Discard all non-wound cards from hand
    const nonWoundsToDiscard = newHand.filter((cardId) => cardId !== CARD_WOUND);
    finalHand = newHand.filter((cardId) => cardId === CARD_WOUND);
    finalDiscard = [...newDiscard, ...nonWoundsToDiscard];
    events.push({
      type: PLAYER_KNOCKED_OUT,
      playerId,
      woundsThisCombat: totalWoundsThisCombat,
    });
  }

  const updatedPlayer: Player = {
    ...player,
    hand: finalHand,
    discard: finalDiscard,
    knockedOut: isKnockedOut,
  };

  return {
    player: updatedPlayer,
    events,
    woundsToHand: heroWounds,
  };
}

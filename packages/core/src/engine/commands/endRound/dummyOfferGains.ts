/**
 * Dummy Player Offer Gains at End of Round
 *
 * Per the solo mode rulebook:
 * - The dummy gains the bottom Advanced Action card from the offer
 * - The dummy gains a crystal matching the color of the removed spell
 *
 * @module commands/endRound/dummyOfferGains
 */

import type { GameEvent, BasicManaColor } from "@mage-knight/shared";
import {
  DUMMY_GAINED_CARD,
  DUMMY_GAINED_CRYSTAL,
} from "@mage-knight/shared";
import type { DummyPlayer } from "../../../types/dummyPlayer.js";
import type { CardOffer } from "../../../types/offers.js";
import { getSpellColor } from "../../helpers/cardColor.js";
import type { BasicCardColor } from "../../../types/effectTypes.js";

export interface DummyOfferGainsResult {
  readonly dummyPlayer: DummyPlayer;
  readonly advancedActionOffer: CardOffer;
  readonly spellOffer: CardOffer;
  readonly events: GameEvent[];
}

/**
 * Map BasicCardColor to BasicManaColor (same string values, different types).
 */
function cardColorToManaColor(color: BasicCardColor): BasicManaColor {
  return color as BasicManaColor;
}

/**
 * Process dummy player gains from offer refresh.
 *
 * Called BEFORE the normal offer refresh so the dummy extracts the bottom
 * card from the AA offer (which would otherwise go to the deck bottom).
 *
 * For spells: the bottom spell is still returned to the deck per normal rules,
 * but the dummy gains a crystal of that spell's color.
 */
export function processDummyOfferGains(
  dummyPlayer: DummyPlayer,
  aaOffer: CardOffer,
  spellOffer: CardOffer,
): DummyOfferGainsResult {
  const events: GameEvent[] = [];
  let updatedDummy = dummyPlayer;

  // 1. Extract bottom AA card from offer for the dummy
  let updatedAAOffer = aaOffer;
  if (aaOffer.cards.length > 0) {
    const bottomAA = aaOffer.cards[aaOffer.cards.length - 1];
    if (bottomAA !== undefined) {
      // Add to dummy's discard (will be shuffled into deck at round reset)
      updatedDummy = {
        ...updatedDummy,
        discard: [...updatedDummy.discard, bottomAA],
      };

      // Remove from offer
      updatedAAOffer = {
        cards: aaOffer.cards.slice(0, -1),
      };

      events.push({
        type: DUMMY_GAINED_CARD,
        cardId: bottomAA,
      });
    }
  }

  // 2. Determine the color of the bottom spell for crystal gain
  let updatedSpellOffer = spellOffer;
  if (spellOffer.cards.length > 0) {
    const bottomSpell = spellOffer.cards[spellOffer.cards.length - 1];
    if (bottomSpell !== undefined) {
      const spellColor = getSpellColor(bottomSpell);
      if (spellColor !== null) {
        const manaColor = cardColorToManaColor(spellColor);
        // Dummy crystals have no cap
        updatedDummy = {
          ...updatedDummy,
          crystals: {
            ...updatedDummy.crystals,
            [manaColor]: (updatedDummy.crystals[manaColor] ?? 0) + 1,
          },
        };

        events.push({
          type: DUMMY_GAINED_CRYSTAL,
          color: manaColor,
        });
      }
      // Note: spell offer is NOT modified here — normal spell refresh handles it
    }
  }

  return {
    dummyPlayer: updatedDummy,
    advancedActionOffer: updatedAAOffer,
    spellOffer: updatedSpellOffer,
    events,
  };
}

import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_KRANG_SAVAGE_HARVESTING } from "@mage-knight/shared";
import { move, compound, discardForCrystal } from "../helpers.js";

/**
 * Krang's Savage Harvesting (replaces March)
 *
 * Basic: Move 2 + optionally discard a non-wound card to gain a crystal
 * Powered (Green): Move 4 + optionally discard a non-wound card to gain a crystal
 *
 * - Action cards: crystal color matches the card's frame color
 * - Artifacts: player chooses the crystal color
 * - Wounds cannot be discarded
 */
export const KRANG_SAVAGE_HARVESTING: DeedCard = {
  id: CARD_KRANG_SAVAGE_HARVESTING,
  name: "Savage Harvesting",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
  basicEffect: compound(move(2), discardForCrystal()),
  poweredEffect: compound(move(4), discardForCrystal()),
  sidewaysValue: 1,
};

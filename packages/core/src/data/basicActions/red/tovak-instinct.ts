import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../../types/cards.js";
import { MANA_RED, CARD_TOVAK_INSTINCT } from "@mage-knight/shared";
import { move, influence, attack, block, choice } from "../helpers.js";

/**
 * Tovak's Instinct (replaces Improvisation)
 */
export const TOVAK_INSTINCT: DeedCard = {
  id: CARD_TOVAK_INSTINCT,
  name: "Instinct",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_MOVEMENT, CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Move 2, Influence 2, Attack 2, or Block 2 (no discard required!)
  // Powered: Move 4, Influence 4, Attack 4, or Block 4
  basicEffect: choice(move(2), influence(2), attack(2), block(2)),
  poweredEffect: choice(move(4), influence(4), attack(4), block(4)),
  sidewaysValue: 1,
};

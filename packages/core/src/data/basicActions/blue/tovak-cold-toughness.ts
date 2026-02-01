import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_MELEE } from "../../../types/effectTypes.js";
import { ELEMENT_ICE } from "../../../types/modifierConstants.js";
import { MANA_BLUE, CARD_TOVAK_COLD_TOUGHNESS } from "@mage-knight/shared";
import { attackWithElement, blockWithElement, choice } from "../helpers.js";

/**
 * Tovak's Cold Toughness (replaces Determination)
 */
export const TOVAK_COLD_TOUGHNESS: DeedCard = {
  id: CARD_TOVAK_COLD_TOUGHNESS,
  name: "Cold Toughness",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  basicEffect: choice(
    attackWithElement(2, COMBAT_TYPE_MELEE, ELEMENT_ICE),
    blockWithElement(3, ELEMENT_ICE)
  ),
  poweredEffect: blockWithElement(5, ELEMENT_ICE),
  sidewaysValue: 1,
};

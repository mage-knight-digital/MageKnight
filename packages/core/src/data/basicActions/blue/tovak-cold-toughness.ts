import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_MELEE, EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_COLD_TOUGHNESS_BLOCK,
  ELEMENT_ICE,
} from "../../../types/modifierConstants.js";
import { MANA_BLUE, CARD_TOVAK_COLD_TOUGHNESS } from "@mage-knight/shared";
import { attackWithElement, blockWithElement, choice, compound } from "../helpers.js";

/**
 * Tovak's Cold Toughness (replaces Determination)
 *
 * Basic: Ice Attack 2 OR Ice Block 3
 * Powered: Ice Block 5. +1 ice block per ability/attack color/resistance on blocked enemy.
 *          Arcane Immunity negates the bonus (only base 5 applies).
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
  poweredEffect: compound(
    blockWithElement(5, ELEMENT_ICE),
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_COLD_TOUGHNESS_BLOCK },
      duration: DURATION_COMBAT,
      description: "+1 Ice Block per ability/color/resistance on blocked enemy",
    }
  ),
  sidewaysValue: 1,
};

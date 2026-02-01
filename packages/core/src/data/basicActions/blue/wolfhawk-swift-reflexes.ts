import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_RANGED } from "../../../types/effectTypes.js";
import { MANA_BLUE, CARD_WOLFHAWK_SWIFT_REFLEXES } from "@mage-knight/shared";
import { move, attack, choice } from "../helpers.js";

/**
 * Wolfhawk's Swift Reflexes (replaces Swiftness)
 */
export const WOLFHAWK_SWIFT_REFLEXES: DeedCard = {
  id: CARD_WOLFHAWK_SWIFT_REFLEXES,
  name: "Swift Reflexes",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  basicEffect: choice(move(2), attack(1, COMBAT_TYPE_RANGED)),
  poweredEffect: choice(move(4), attack(3, COMBAT_TYPE_RANGED)),
  sidewaysValue: 1,
};

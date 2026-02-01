import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_MELEE, COMBAT_TYPE_RANGED, COMBAT_TYPE_SIEGE } from "../../../types/effectTypes.js";
import { ELEMENT_FIRE } from "../../../types/modifierConstants.js";
import { MANA_RED, CARD_ARYTHEA_BATTLE_VERSATILITY } from "@mage-knight/shared";
import { attack, attackWithElement, block, blockWithElement, choice } from "../helpers.js";

/**
 * Arythea's Battle Versatility (replaces Rage)
 */
export const ARYTHEA_BATTLE_VERSATILITY: DeedCard = {
  id: CARD_ARYTHEA_BATTLE_VERSATILITY,
  name: "Battle Versatility",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2, Block 2, or Ranged Attack 1
  // Powered: Attack 4, Block 4, Fire Attack 3, Fire Block 3, Ranged Attack 3, or Siege Attack 2
  basicEffect: choice(attack(2), block(2), attack(1, COMBAT_TYPE_RANGED)),
  poweredEffect: choice(
    attack(4),
    block(4),
    attackWithElement(3, COMBAT_TYPE_MELEE, ELEMENT_FIRE),
    blockWithElement(3, ELEMENT_FIRE),
    attack(3, COMBAT_TYPE_RANGED),
    attack(2, COMBAT_TYPE_SIEGE)
  ),
  sidewaysValue: 1,
};

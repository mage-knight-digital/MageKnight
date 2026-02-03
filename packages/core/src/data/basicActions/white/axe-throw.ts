import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { COMBAT_TYPE_RANGED } from "../../../types/effectTypes.js";
import { MANA_WHITE, CARD_AXE_THROW } from "@mage-knight/shared";
import { attack, choice, compound, move, trackAttackDefeatFame } from "../helpers.js";

export const AXE_THROW: DeedCard = {
  id: CARD_AXE_THROW,
  name: "Axe Throw",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  // Basic: Move 2 OR Ranged Attack 1
  // Powered: Ranged Attack 3. Fame +1 if you defeated at least one enemy with this attack.
  basicEffect: choice(move(2), attack(1, COMBAT_TYPE_RANGED)),
  poweredEffect: compound(
    attack(3, COMBAT_TYPE_RANGED),
    trackAttackDefeatFame(3, COMBAT_TYPE_RANGED, 1, undefined, CARD_AXE_THROW)
  ),
  sidewaysValue: 1,
};

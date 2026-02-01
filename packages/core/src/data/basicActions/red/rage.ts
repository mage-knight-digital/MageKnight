import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_RAGE } from "@mage-knight/shared";
import { attack, block, choice } from "../helpers.js";

export const RAGE: DeedCard = {
  id: CARD_RAGE,
  name: "Rage",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack or Block 2 | Powered: Attack 4
  basicEffect: choice(attack(2), block(2)),
  poweredEffect: attack(4),
  sidewaysValue: 1,
};

import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { SCALING_PER_WOUND_THIS_COMBAT } from "../../../types/scaling.js";
import { MANA_RED, CARD_KRANG_BATTLE_RAGE } from "@mage-knight/shared";
import { scalingAttack } from "../../effectHelpers.js";

/**
 * Krang's Battle Rage (replaces Rage)
 */
export const KRANG_BATTLE_RAGE: DeedCard = {
  id: CARD_KRANG_BATTLE_RAGE,
  name: "Battle Rage",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2. +1 if you received a wound during this battle.
  basicEffect: scalingAttack(
    2,
    { type: SCALING_PER_WOUND_THIS_COMBAT },
    1,
    undefined,
    undefined,
    { maximum: 1 }
  ),
  // Powered: Attack 4. +1 per wound received during this battle (max +4).
  poweredEffect: scalingAttack(
    4,
    { type: SCALING_PER_WOUND_THIS_COMBAT },
    1,
    undefined,
    undefined,
    { maximum: 4 }
  ),
  sidewaysValue: 1,
};

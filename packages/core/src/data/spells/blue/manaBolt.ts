/**
 * Mana Bolt / Mana Thunderbolt (Blue Spell)
 *
 * Basic (Mana Bolt): Pay a mana token. Attack determined by color:
 * - Blue → Ice Attack 8
 * - Red → Cold Fire Attack 7
 * - White → Ranged Ice Attack 6
 * - Green → Siege Ice Attack 5
 *
 * Powered (Mana Thunderbolt): Pay a mana token. Attack determined by color:
 * - Blue → Ice Attack 11
 * - Red → Cold Fire Attack 10
 * - White → Ranged Ice Attack 9
 * - Green → Siege Ice Attack 8
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_MANA_BOLT } from "../../../types/effectTypes.js";
import { MANA_BLACK, MANA_BLUE, CARD_MANA_BOLT } from "@mage-knight/shared";

export const MANA_BOLT: DeedCard = {
  id: CARD_MANA_BOLT,
  name: "Mana Bolt",
  poweredName: "Mana Thunderbolt",
  cardType: DEED_CARD_TYPE_SPELL,
  poweredBy: [MANA_BLACK, MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  basicEffect: { type: EFFECT_MANA_BOLT, baseValue: 8 },
  poweredEffect: { type: EFFECT_MANA_BOLT, baseValue: 11 },
  sidewaysValue: 1,
};

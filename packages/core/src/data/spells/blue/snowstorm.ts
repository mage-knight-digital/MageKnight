/**
 * Snowstorm / Blizzard (Blue Spell #15)
 * Basic: Ranged Ice Attack 5
 * Powered: Take a Wound. Siege Ice Attack 8.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_COMPOUND, EFFECT_TAKE_WOUND } from "../../../types/effectTypes.js";
import { MANA_BLUE, MANA_BLACK, CARD_SNOWSTORM } from "@mage-knight/shared";
import { iceRangedAttack, iceSiegeAttack } from "../helpers.js";

export const SNOWSTORM: DeedCard = {
  id: CARD_SNOWSTORM,
  name: "Snowstorm",
  poweredName: "Blizzard",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_BLUE],
  basicEffect: iceRangedAttack(5),
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [{ type: EFFECT_TAKE_WOUND, amount: 1 }, iceSiegeAttack(8)],
  },
  sidewaysValue: 1,
};

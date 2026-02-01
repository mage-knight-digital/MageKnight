/**
 * Fireball (Red Spell #09)
 * Basic: Ranged Fire Attack 5
 * Powered: Take a Wound. Siege Fire Attack 8.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_COMPOUND, EFFECT_TAKE_WOUND } from "../../../types/effectTypes.js";
import { MANA_RED, MANA_BLACK, CARD_FIREBALL } from "@mage-knight/shared";
import { fireRangedAttack, fireSiegeAttack } from "../helpers.js";

export const FIREBALL: DeedCard = {
  id: CARD_FIREBALL,
  name: "Fireball",
  poweredName: "Firestorm",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: fireRangedAttack(5),
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [{ type: EFFECT_TAKE_WOUND, amount: 1 }, fireSiegeAttack(8)],
  },
  sidewaysValue: 1,
};

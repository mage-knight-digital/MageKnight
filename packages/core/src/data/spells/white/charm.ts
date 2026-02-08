/**
 * Charm / Possess (White Spell #21)
 *
 * Basic (Charm): Influence 4. If during Interaction, choose:
 *   gain a crystal of any color OR get a 3 discount towards one Unit cost.
 *
 * Powered (Possess): One enemy does not attack. In the Attack phase,
 *   gain Attack equal to its attack value including elements (but not
 *   special abilities). Can only target OTHER enemies with this attack.
 *   Cannot target Arcane Immune enemies.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { EFFECT_POSSESS_ENEMY } from "../../../types/effectTypes.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  CARD_CHARM,
} from "@mage-knight/shared";
import {
  influence,
  compound,
  choice,
  ifInInteraction,
} from "../../effectHelpers.js";
import { gainCrystal, recruitDiscount } from "../../basicActions/helpers.js";

export const CHARM: DeedCard = {
  id: CARD_CHARM,
  name: "Charm",
  poweredName: "Possess",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_INFLUENCE],
  poweredEffectCategories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: compound([
    influence(4),
    ifInInteraction(
      choice([
        gainCrystal(MANA_RED),
        gainCrystal(MANA_BLUE),
        gainCrystal(MANA_GREEN),
        gainCrystal(MANA_WHITE),
        recruitDiscount(3, 0),
      ])
    ),
  ]),
  poweredEffect: {
    type: EFFECT_POSSESS_ENEMY,
  },
  sidewaysValue: 1,
};

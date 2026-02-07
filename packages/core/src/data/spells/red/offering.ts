/**
 * Offering / Sacrifice (Red Spell #46)
 *
 * Basic (Offering): Gain a red crystal. You may discard up to 3 non-Wound cards
 * from your hand. For each discarded card, gain a crystal of matching color.
 * For artifacts, you choose any basic color.
 *
 * Powered (Sacrifice): Choose green OR white, then choose red OR blue.
 * Count crystal pairs of chosen colors:
 * - green+red → Siege Fire Attack 4 per pair
 * - green+blue → Siege Ice Attack 4 per pair
 * - white+red → Ranged Fire Attack 6 per pair
 * - white+blue → Ranged Ice Attack 6 per pair
 * Then convert ALL complete crystal pairs to mana tokens (immediately usable).
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_DISCARD_FOR_CRYSTAL,
  EFFECT_SACRIFICE,
} from "../../../types/effectTypes.js";
import { MANA_RED, MANA_BLACK, CARD_OFFERING } from "@mage-knight/shared";

export const OFFERING: DeedCard = {
  id: CARD_OFFERING,
  name: "Offering",
  poweredName: "Sacrifice",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_SPECIAL],
  poweredEffectCategories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Gain a red crystal
      { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
      // Optionally discard up to 3 non-wound cards for crystals (sequential)
      { type: EFFECT_DISCARD_FOR_CRYSTAL, optional: true },
      { type: EFFECT_DISCARD_FOR_CRYSTAL, optional: true },
      { type: EFFECT_DISCARD_FOR_CRYSTAL, optional: true },
    ],
  },
  poweredEffect: {
    type: EFFECT_SACRIFICE,
  },
  sidewaysValue: 1,
};

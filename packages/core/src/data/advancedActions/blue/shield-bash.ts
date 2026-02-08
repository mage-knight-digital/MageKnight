import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_BLOCK,
  EFFECT_APPLY_MODIFIER,
} from "../../../types/effectTypes.js";
import { MANA_BLUE, CARD_SHIELD_BASH } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_SHIELD_BASH_ARMOR_REDUCTION,
} from "../../../types/modifierConstants.js";

export const SHIELD_BASH: DeedCard = {
  id: CARD_SHIELD_BASH,
  name: "Shield Bash",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_COMBAT],
  // Basic: Block 3. Counts twice against an attack with Swiftness.
  basicEffect: {
    type: EFFECT_GAIN_BLOCK,
    amount: 3,
    countsTwiceAgainstSwift: true,
  },
  // Powered: Block 5. Counts twice against an attack with Swiftness.
  // Blocked enemy gets Armor -1 for each point of block higher than needed (to a minimum of 1).
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      {
        type: EFFECT_GAIN_BLOCK,
        amount: 5,
        countsTwiceAgainstSwift: true,
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_SHIELD_BASH_ARMOR_REDUCTION,
        },
        duration: DURATION_COMBAT,
        description: "On successful block: reduce enemy Armor by excess block",
      },
    ],
  },
  sidewaysValue: 1,
};

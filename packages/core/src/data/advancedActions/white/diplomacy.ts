import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
  EFFECT_RULE_OVERRIDE,
  RULE_INFLUENCE_CARDS_IN_COMBAT,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "../../../types/modifierConstants.js";
import { MANA_WHITE, CARD_DIPLOMACY } from "@mage-knight/shared";
import { influence, compound, choice } from "../helpers.js";

export const DIPLOMACY: DeedCard = {
  id: CARD_DIPLOMACY,
  name: "Diplomacy",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Influence 2. You may use Influence as Block this turn.
  basicEffect: compound(
    influence(2),
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
        costPerPoint: 1,
      },
      duration: DURATION_TURN,
      description: "During combat, spend 1 Influence for 1 Block",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_INFLUENCE_CARDS_IN_COMBAT,
      },
      duration: DURATION_TURN,
      description: "Influence cards can be played during combat",
    },
  ),
  // Powered: Influence 4. Choose Ice or Fire. You may use Influence as Block of the chosen element this turn.
  poweredEffect: compound(
    influence(4),
    choice(
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
          costPerPoint: 1,
          element: ELEMENT_ICE,
        },
        duration: DURATION_TURN,
        description: "During combat, spend 1 Influence for 1 Ice Block",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
          costPerPoint: 1,
          element: ELEMENT_FIRE,
        },
        duration: DURATION_TURN,
        description: "During combat, spend 1 Influence for 1 Fire Block",
      },
    ),
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_INFLUENCE_CARDS_IN_COMBAT,
      },
      duration: DURATION_TURN,
      description: "Influence cards can be played during combat",
    },
  ),
  sidewaysValue: 1,
};

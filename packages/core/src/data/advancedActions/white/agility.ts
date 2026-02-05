import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import {
  COMBAT_VALUE_ATTACK,
  COMBAT_VALUE_RANGED,
  DURATION_TURN,
  EFFECT_MOVE_TO_ATTACK_CONVERSION,
  EFFECT_RULE_OVERRIDE,
  RULE_MOVE_CARDS_IN_COMBAT,
} from "../../../types/modifierConstants.js";
import { MANA_WHITE, CARD_AGILITY } from "@mage-knight/shared";
import { move, compound } from "../helpers.js";

export const AGILITY: DeedCard = {
  id: CARD_AGILITY,
  name: "Agility",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  // Basic: Move 2. During combat this turn, you may spend Move points to get Attack 1 for each.
  basicEffect: compound(
    move(2),
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_MOVE_TO_ATTACK_CONVERSION,
        costPerPoint: 1,
        attackType: COMBAT_VALUE_ATTACK,
      },
      duration: DURATION_TURN,
      description: "During combat, spend 1 Move for 1 Attack",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_MOVE_CARDS_IN_COMBAT,
      },
      duration: DURATION_TURN,
      description: "Movement cards can be played during combat",
    },
  ),
  // Powered: Move 4. During combat: 1 Move = 1 Attack OR 2 Move = 1 Ranged Attack.
  poweredEffect: compound(
    move(4),
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_MOVE_TO_ATTACK_CONVERSION,
        costPerPoint: 1,
        attackType: COMBAT_VALUE_ATTACK,
      },
      duration: DURATION_TURN,
      description: "During combat, spend 1 Move for 1 Attack",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_MOVE_TO_ATTACK_CONVERSION,
        costPerPoint: 2,
        attackType: COMBAT_VALUE_RANGED,
      },
      duration: DURATION_TURN,
      description: "During combat, spend 2 Move for 1 Ranged Attack",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_MOVE_CARDS_IN_COMBAT,
      },
      duration: DURATION_TURN,
      description: "Movement cards can be played during combat",
    },
  ),
  sidewaysValue: 1,
};

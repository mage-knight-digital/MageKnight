import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_INTO_THE_HEAT } from "@mage-knight/shared";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../../types/combat.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_RULE_OVERRIDE,
  EFFECT_UNIT_COMBAT_BONUS,
  RULE_UNITS_CANNOT_ABSORB_DAMAGE,
  SCOPE_ALL_UNITS,
} from "../../../types/modifierConstants.js";
import { compound } from "../helpers.js";

export const INTO_THE_HEAT: DeedCard = {
  id: CARD_INTO_THE_HEAT,
  name: "Into the Heat",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  combatPhaseRestriction: [COMBAT_PHASE_RANGED_SIEGE],
  basicEffect: compound(
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_UNIT_COMBAT_BONUS, attackBonus: 2, blockBonus: 2 },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_ALL_UNITS },
      description: "All units get +2 Attack and +2 Block this combat",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_RULE_OVERRIDE, rule: RULE_UNITS_CANNOT_ABSORB_DAMAGE },
      duration: DURATION_COMBAT,
      description: "Cannot assign damage to units this combat",
    },
  ),
  poweredEffect: compound(
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_UNIT_COMBAT_BONUS, attackBonus: 3, blockBonus: 3 },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_ALL_UNITS },
      description: "All units get +3 Attack and +3 Block this combat",
    },
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: { type: EFFECT_RULE_OVERRIDE, rule: RULE_UNITS_CANNOT_ABSORB_DAMAGE },
      duration: DURATION_COMBAT,
      description: "Cannot assign damage to units this combat",
    },
  ),
  sidewaysValue: 1,
};

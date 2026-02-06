/**
 * Fire Mages unit definition
 *
 * Rulebook:
 * - Ranged Fire Attack 3 - basic ranged attack
 * - (Red Mana) Fire Attack OR Fire Block 6 - mana-powered choice ability
 * - Gain red mana token + red crystal - resource generation
 */

import { ELEMENT_FIRE } from "../../elements.js";
import { RESIST_FIRE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_FIRE_MAGES } from "../ids.js";
import { MANA_RED } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const FIRE_MAGES_ATTACK_OR_BLOCK = "fire_mages_attack_or_block";
const FIRE_MAGES_GAIN_MANA_CRYSTAL = "fire_mages_gain_mana_crystal";

export const FIRE_MAGES: UnitDefinition = {
  id: UNIT_FIRE_MAGES,
  name: "Fire Mages",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 3,
  resistances: [RESIST_FIRE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    // Basic: Ranged Fire Attack 3 (no mana cost)
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_FIRE },
    // Red mana: Fire Attack 6 OR Fire Block 6
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: FIRE_MAGES_ATTACK_OR_BLOCK,
      displayName: "Fire Attack 6 OR Fire Block 6",
      manaCost: MANA_RED,
    },
    // Resource generation: Gain red mana + red crystal (no mana cost, no combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: FIRE_MAGES_GAIN_MANA_CRYSTAL,
      displayName: "Gain Red Mana + Crystal",
      requiresCombat: false,
    },
  ],
  copies: 2,
};

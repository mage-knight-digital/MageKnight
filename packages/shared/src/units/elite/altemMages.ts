/**
 * Altem Mages unit definition
 *
 * Abilities:
 * 1. Gain 2 mana tokens of any colors (free, non-combat)
 * 2. Cold Fire Attack 5 OR Cold Fire Block 5 (free, combat)
 *    Scaling: +blue = 7, +red = 7, +both = 9
 * 3. (Black Mana) Choose: All attacks become Cold Fire OR all attacks gain Siege
 */

import { RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_ALTEM_MAGES } from "../ids.js";
import { MANA_BLACK } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const ALTEM_MAGES_GAIN_TWO_MANA = "altem_mages_gain_two_mana";
const ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK =
  "altem_mages_cold_fire_attack_or_block";
const ALTEM_MAGES_ATTACK_MODIFIER = "altem_mages_attack_modifier";

export const ALTEM_MAGES: UnitDefinition = {
  id: UNIT_ALTEM_MAGES,
  name: "Altem Mages",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 12,
  armor: 5,
  resistances: [RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_CITY],
  abilities: [
    // Ability 1: Gain 2 mana tokens of any colors (free, non-combat)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ALTEM_MAGES_GAIN_TWO_MANA,
      displayName: "Gain 2 Mana Tokens",
      requiresCombat: false,
    },
    // Ability 2: Cold Fire Attack 5 OR Cold Fire Block 5 (free, combat)
    // Scaling: +blue = 7, +red = 7, +both = 9
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ALTEM_MAGES_COLD_FIRE_ATTACK_OR_BLOCK,
      displayName: "Cold Fire Attack OR Block 5",
    },
    // Ability 3: (Black Mana) Attack modifier - Cold Fire or Siege
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ALTEM_MAGES_ATTACK_MODIFIER,
      displayName: "All Attacks: Cold Fire or +Siege",
      manaCost: MANA_BLACK,
    },
  ],
  copies: 2,
};

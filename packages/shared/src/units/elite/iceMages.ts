/**
 * Ice Mages unit definition
 *
 * Abilities:
 * 1. Ice Attack 4 OR Ice Block 4 - choice ability (free)
 * 2. (Blue Mana) Siege Ice Attack 4 - mana-powered siege
 * 3. Gain blue mana token + blue crystal - resource generation (free)
 */

import { RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_ICE_MAGES } from "../ids.js";
import { MANA_BLUE } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const ICE_MAGES_ATTACK_OR_BLOCK = "ice_mages_attack_or_block";
const ICE_MAGES_SIEGE_ATTACK = "ice_mages_siege_attack";
const ICE_MAGES_GAIN_MANA_CRYSTAL = "ice_mages_gain_mana_crystal";

export const ICE_MAGES: UnitDefinition = {
  id: UNIT_ICE_MAGES,
  name: "Ice Mages",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_ICE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    // Basic: Ice Attack 4 OR Ice Block 4 (choice, no mana cost)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ICE_MAGES_ATTACK_OR_BLOCK,
      displayName: "Ice Attack 4 OR Ice Block 4",
    },
    // Blue mana: Siege Ice Attack 4
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ICE_MAGES_SIEGE_ATTACK,
      displayName: "Siege Ice Attack 4",
      manaCost: MANA_BLUE,
    },
    // Resource generation: Gain blue mana + blue crystal (no mana cost, no combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ICE_MAGES_GAIN_MANA_CRYSTAL,
      displayName: "Gain Blue Mana + Crystal",
      requiresCombat: false,
    },
  ],
  copies: 2,
};

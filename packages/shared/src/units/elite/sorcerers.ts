/**
 * Sorcerers unit definition
 *
 * Abilities:
 * 1. Basic Ranged Attack 3
 * 2. (White Mana) Strip fortifications from one enemy + Ranged Attack 3
 * 3. (Green Mana) Strip resistances from one enemy + Ranged Attack 3
 *
 * FAQ Notes:
 * - Arcane Immunity blocks fortification/resistance removal, but ranged attack still works
 * - Bundled ranged attack must be used in same phase or forfeited
 * - Can target different enemies for debuff vs attack (compound effect)
 */

import { MANA_WHITE, MANA_GREEN } from "../../ids.js";
import { RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_SORCERERS } from "../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const SORCERERS_STRIP_FORTIFICATION = "sorcerers_strip_fortification";
const SORCERERS_STRIP_RESISTANCES = "sorcerers_strip_resistances";

export const SORCERERS: UnitDefinition = {
  id: UNIT_SORCERERS,
  name: "Sorcerers",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    // Basic: Ranged Attack 3 (no mana cost)
    {
      type: UNIT_ABILITY_RANGED_ATTACK,
      value: 3,
    },
    // White mana: Strip fortification from one enemy + Ranged Attack 3
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SORCERERS_STRIP_FORTIFICATION,
      displayName: "Strip Fortification + Ranged Attack 3",
      manaCost: MANA_WHITE,
    },
    // Green mana: Strip resistances from one enemy + Ranged Attack 3
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SORCERERS_STRIP_RESISTANCES,
      displayName: "Strip Resistances + Ranged Attack 3",
      manaCost: MANA_GREEN,
    },
  ],
  copies: 2,
};

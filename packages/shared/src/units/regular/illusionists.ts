/**
 * Illusionists unit definition
 *
 * Abilities:
 * 1. Influence 4 (free)
 * 2. (White Mana) Cancel unfortified enemy's attack this combat
 * 3. Gain white crystal (free)
 *
 * FAQ Notes:
 * - Cancel Attack only works on unfortified enemies
 * - Arcane Immunity blocks the cancel attack effect
 * - Works against Summon Attacks (if used BEFORE token drawn)
 * - Cancels ALL attacks from Multi-Attack enemies
 * - Can combo with Demolish (remove fortification first, then cancel)
 */

import { MANA_WHITE } from "../../ids.js";
import { RESIST_PHYSICAL } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_ILLUSIONISTS } from "../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const ILLUSIONISTS_CANCEL_ATTACK = "illusionists_cancel_attack";
const ILLUSIONISTS_GAIN_WHITE_CRYSTAL = "illusionists_gain_white_crystal";

export const ILLUSIONISTS: UnitDefinition = {
  id: UNIT_ILLUSIONISTS,
  name: "Illusionists",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 2,
  resistances: [RESIST_PHYSICAL],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    // Ability 1: Influence 4 (free)
    { type: UNIT_ABILITY_INFLUENCE, value: 4 },
    // Ability 2: Cancel unfortified enemy's attack (white mana, combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ILLUSIONISTS_CANCEL_ATTACK,
      displayName: "Cancel Enemy Attack",
      manaCost: MANA_WHITE,
    },
    // Ability 3: Gain white crystal (free, no combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ILLUSIONISTS_GAIN_WHITE_CRYSTAL,
      displayName: "Gain White Crystal",
      requiresCombat: false,
    },
  ],
  copies: 2,
};

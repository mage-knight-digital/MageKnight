/**
 * Ice Golems unit definition
 *
 * Rulebook:
 * - Attack OR Block 3 (choice ability, free)
 * - (Blue Mana) Ice Attack 6 - mana-powered attack
 */

import { ELEMENT_ICE } from "../../elements.js";
import { MANA_BLUE } from "../../ids.js";
import { RESIST_PHYSICAL, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_ICE_GOLEMS } from "../ids.js";

const ICE_GOLEMS_ATTACK_OR_BLOCK = "ice_golems_attack_or_block";

export const ICE_GOLEMS: UnitDefinition = {
  id: UNIT_ICE_GOLEMS,
  name: "Ice Golems",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 8,
  armor: 4,
  resistances: [RESIST_PHYSICAL, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_MAGE_TOWER],
  abilities: [
    // Attack 3 OR Block 3 (Ice) - choice, no mana cost
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ICE_GOLEMS_ATTACK_OR_BLOCK,
      displayName: "Attack 3 OR Block 3",
    },
    // (Blue Mana) Ice Attack 6
    { type: UNIT_ABILITY_ATTACK, value: 6, element: ELEMENT_ICE, manaCost: MANA_BLUE },
  ],
  copies: 2,
};

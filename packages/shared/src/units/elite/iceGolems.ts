/**
 * Ice Golems unit definition
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
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_PARALYZE,
} from "../constants.js";
import { UNIT_ICE_GOLEMS } from "../ids.js";

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
    // Base abilities (free)
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_ICE },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_ICE },
    // Powered abilities (require blue mana)
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_ICE, manaCost: MANA_BLUE },
    { type: UNIT_ABILITY_BLOCK, value: 5, element: ELEMENT_ICE, manaCost: MANA_BLUE },
    // Passive
    { type: UNIT_ABILITY_PARALYZE },
  ],
  copies: 2,
};

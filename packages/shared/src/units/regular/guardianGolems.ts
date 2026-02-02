/**
 * Guardian Golems unit definition
 *
 * Rulebook abilities:
 * - Ability 1: Attack OR Block 2 (physical, free)
 * - Ability 2: Fire Block 4 (red mana)
 * - Ability 3: Ice Block 4 (blue mana)
 */

import { ELEMENT_PHYSICAL, ELEMENT_FIRE, ELEMENT_ICE } from "../../elements.js";
import { MANA_RED, MANA_BLUE } from "../../ids.js";
import { RESIST_PHYSICAL } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_GUARDIAN_GOLEMS } from "../ids.js";

export const GUARDIAN_GOLEMS: UnitDefinition = {
  id: UNIT_GUARDIAN_GOLEMS,
  name: "Guardian Golems",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 3,
  resistances: [RESIST_PHYSICAL],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_KEEP],
  abilities: [
    // Ability 1: Attack 2 OR Block 2 (physical, free)
    { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
    // Ability 2: Fire Block 4 (red mana)
    { type: UNIT_ABILITY_BLOCK, value: 4, element: ELEMENT_FIRE, manaCost: MANA_RED },
    // Ability 3: Ice Block 4 (blue mana)
    { type: UNIT_ABILITY_BLOCK, value: 4, element: ELEMENT_ICE, manaCost: MANA_BLUE },
  ],
  copies: 2,
};

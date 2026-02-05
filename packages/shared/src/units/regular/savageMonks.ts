/**
 * Savage Monks unit definition
 *
 * Rulebook abilities:
 * - Ability 1: Attack OR Block 3 (physical, free)
 * - Ability 2: Siege Attack 4 (green mana)
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import { MANA_GREEN } from "../../ids.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "../constants.js";
import { UNIT_SAVAGE_MONKS } from "../ids.js";

export const SAVAGE_MONKS: UnitDefinition = {
  id: UNIT_SAVAGE_MONKS,
  name: "Savage Monks",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_MONASTERY],
  abilities: [
    // Ability 1: Attack 3 OR Block 3 (physical, free)
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
    // Ability 2: Siege Attack 4 (green mana)
    { type: UNIT_ABILITY_SIEGE_ATTACK, value: 4, element: ELEMENT_PHYSICAL, manaCost: MANA_GREEN },
  ],
  copies: 1,
};

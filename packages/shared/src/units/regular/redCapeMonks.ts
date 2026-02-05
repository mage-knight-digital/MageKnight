/**
 * Red Cape Monks unit definition
 *
 * Rulebook abilities:
 * - Ability 1: Attack OR Block 3 (physical, free)
 * - Ability 2: Fire Attack OR Fire Block 4 (red mana)
 */

import { ELEMENT_FIRE, ELEMENT_PHYSICAL } from "../../elements.js";
import { MANA_RED } from "../../ids.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_RED_CAPE_MONKS } from "../ids.js";

export const RED_CAPE_MONKS: UnitDefinition = {
  id: UNIT_RED_CAPE_MONKS,
  name: "Red Cape Monks",
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
    // Ability 2: Fire Attack 4 OR Fire Block 4 (red mana)
    { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_FIRE, manaCost: MANA_RED },
    { type: UNIT_ABILITY_BLOCK, value: 4, element: ELEMENT_FIRE, manaCost: MANA_RED },
  ],
  copies: 1,
};

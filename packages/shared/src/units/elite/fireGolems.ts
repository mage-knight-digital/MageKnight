/**
 * Fire Golems unit definition
 */

import { ELEMENT_FIRE } from "../../elements.js";
import { MANA_RED } from "../../ids.js";
import { RESIST_PHYSICAL, RESIST_FIRE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_FIRE_GOLEMS } from "../ids.js";

export const FIRE_GOLEMS: UnitDefinition = {
  id: UNIT_FIRE_GOLEMS,
  name: "Fire Golems",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 8,
  armor: 4,
  resistances: [RESIST_PHYSICAL, RESIST_FIRE],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_MAGE_TOWER],
  abilities: [
    // Base abilities (free)
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_FIRE },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_FIRE },
    // Powered abilities (require red mana)
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_FIRE, manaCost: MANA_RED },
    { type: UNIT_ABILITY_BLOCK, value: 5, element: ELEMENT_FIRE, manaCost: MANA_RED },
  ],
  copies: 2,
};

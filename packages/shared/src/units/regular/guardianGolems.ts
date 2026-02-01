/**
 * Guardian Golems unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
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
    { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};

/**
 * Fire Mages unit definition
 */

import { ELEMENT_FIRE } from "../../elements.js";
import { RESIST_FIRE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_RANGED_ATTACK,
} from "../constants.js";
import { UNIT_FIRE_MAGES } from "../ids.js";

export const FIRE_MAGES: UnitDefinition = {
  id: UNIT_FIRE_MAGES,
  name: "Fire Mages",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_FIRE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_FIRE },
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 4, element: ELEMENT_FIRE },
  ],
  copies: 2,
};

/**
 * Ice Mages unit definition
 */

import { ELEMENT_ICE } from "../../elements.js";
import { RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_RANGED_ATTACK,
} from "../constants.js";
import { UNIT_ICE_MAGES } from "../ids.js";

export const ICE_MAGES: UnitDefinition = {
  id: UNIT_ICE_MAGES,
  name: "Ice Mages",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_ICE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_ICE },
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 4, element: ELEMENT_ICE },
  ],
  copies: 2,
};

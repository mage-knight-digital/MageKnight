/**
 * Altem Mages unit definition
 */

import { ELEMENT_FIRE, ELEMENT_ICE } from "../../elements.js";
import { RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
} from "../constants.js";
import { UNIT_ALTEM_MAGES } from "../ids.js";

export const ALTEM_MAGES: UnitDefinition = {
  id: UNIT_ALTEM_MAGES,
  name: "Altem Mages",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 12,
  armor: 5,
  resistances: [RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_FIRE },
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_ICE },
  ],
  copies: 2,
};

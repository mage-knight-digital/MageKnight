/**
 * Amotep Gunners unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "../constants.js";
import { UNIT_AMOTEP_GUNNERS } from "../ids.js";

export const AMOTEP_GUNNERS: UnitDefinition = {
  id: UNIT_AMOTEP_GUNNERS,
  name: "Amotep Gunners",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 8,
  armor: 6,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_SIEGE_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};

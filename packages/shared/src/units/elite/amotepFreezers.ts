/**
 * Amotep Freezers unit definition
 */

import { ELEMENT_ICE } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_PARALYZE,
} from "../constants.js";
import { UNIT_AMOTEP_FREEZERS } from "../ids.js";

export const AMOTEP_FREEZERS: UnitDefinition = {
  id: UNIT_AMOTEP_FREEZERS,
  name: "Amotep Freezers",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 8,
  armor: 6,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_ICE },
    { type: UNIT_ABILITY_SIEGE_ATTACK, value: 3, element: ELEMENT_ICE },
    { type: UNIT_ABILITY_PARALYZE },
  ],
  copies: 2,
};

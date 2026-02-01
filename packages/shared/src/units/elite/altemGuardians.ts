/**
 * Altem Guardians unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_ALTEM_GUARDIANS } from "../ids.js";

export const ALTEM_GUARDIANS: UnitDefinition = {
  id: UNIT_ALTEM_GUARDIANS,
  name: "Altem Guardians",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 11,
  armor: 7,
  resistances: [],
  recruitSites: [RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 5, element: ELEMENT_PHYSICAL },
  ],
  copies: 3,
};

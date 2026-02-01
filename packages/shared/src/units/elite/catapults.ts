/**
 * Catapults unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "../constants.js";
import { UNIT_CATAPULTS } from "../ids.js";

export const CATAPULTS: UnitDefinition = {
  id: UNIT_CATAPULTS,
  name: "Catapults",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_SIEGE_ATTACK, value: 4, element: ELEMENT_PHYSICAL },
  ],
  copies: 3,
};

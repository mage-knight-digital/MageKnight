/**
 * Herbalist unit definition
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_HEAL,
} from "../constants.js";
import { UNIT_HERBALIST } from "../ids.js";

export const HERBALIST: UnitDefinition = {
  id: UNIT_HERBALIST,
  name: "Herbalist",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 3,
  armor: 2,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_MONASTERY],
  abilities: [{ type: UNIT_ABILITY_HEAL, value: 2 }],
  copies: 2,
};

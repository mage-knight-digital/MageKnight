/**
 * Heroes unit definition
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
} from "../constants.js";
import { UNIT_HEROES } from "../ids.js";

export const HEROES: UnitDefinition = {
  id: UNIT_HEROES,
  name: "Heroes",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 5, // Varies by card
  resistances: [], // Varies by card
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [], // Varies by card
  copies: 4,
};

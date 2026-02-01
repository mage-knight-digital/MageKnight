/**
 * Delphana Masters unit definition
 */

import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import { UNIT_TYPE_ELITE, RECRUIT_SITE_CITY } from "../constants.js";
import { UNIT_DELPHANA_MASTERS } from "../ids.js";

export const DELPHANA_MASTERS: UnitDefinition = {
  id: UNIT_DELPHANA_MASTERS,
  name: "Delphana Masters",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 13,
  armor: 3,
  resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_CITY],
  abilities: [], // Special: copy any unit ability
  copies: 2,
};
